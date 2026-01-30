import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Meld, MediaState } from 'shared';
import { roomManager } from '../rooms/RoomManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function setupSocketHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('createRoom', (playerName, callback) => {
      try {
        const { roomCode, playerId } = roomManager.createRoom(socket.id, playerName);
        socket.data.playerId = playerId;
        socket.data.playerName = playerName;
        socket.data.roomCode = roomCode;
        
        socket.join(roomCode);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          socket.emit('roomUpdate', room);
        }
        
        // Send the stable playerId to the client for session persistence
        socket.emit('roomJoined', playerId);
        
        callback({ success: true, roomCode });
      } catch (error) {
        callback({ success: false, error: 'Failed to create room' });
      }
    });

    socket.on('joinRoom', (roomCode, playerName, callback) => {
      try {
        const result = roomManager.joinRoom(roomCode, socket.id, playerName);
        
        if (!result.success || !result.playerId) {
          callback({ success: false, error: result.error });
          return;
        }
        
        socket.data.playerId = result.playerId;
        socket.data.playerName = playerName;
        socket.data.roomCode = roomCode;
        
        socket.join(roomCode);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('roomUpdate', room);
        }
        
        // Send the stable playerId to the client for session persistence
        socket.emit('roomJoined', result.playerId);
        
        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: 'Failed to join room' });
      }
    });

    socket.on('leaveRoom', () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (roomCode && playerId) {
        roomManager.leaveRoom(playerId);
        roomManager.removeSocketMapping(socket.id);
        socket.leave(roomCode);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('roomUpdate', room);
        }
        
        socket.data.roomCode = null;
        socket.data.playerId = '';
      }
    });

    socket.on('startGame', (callback) => {
      const roomCode = socket.data.roomCode;
      const requesterId = socket.data.playerId;
      
      if (!roomCode || !requesterId) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const result = roomManager.startGame(roomCode, requesterId);
      
      if (!result.success) {
        callback(result);
        return;
      }
      
      const game = roomManager.getGame(roomCode);
      const room = roomManager.getRoom(roomCode);
      
      if (!game || !room) {
        callback({ success: false, error: 'Game initialization failed' });
        return;
      }
      
      // Send game state to each player by iterating room sockets
      const roomSockets = io.sockets.adapter.rooms.get(roomCode);
      if (roomSockets) {
        for (const socketId of roomSockets) {
          const playerSocket = io.sockets.sockets.get(socketId);
          if (playerSocket && playerSocket.data.playerId) {
            const state = game.getState(roomCode);
            const tiles = game.getPlayerTiles(playerSocket.data.playerId);
            playerSocket.emit('gameStart', state, tiles);
          }
        }
      }
      
      io.to(roomCode).emit('roomUpdate', room);
      callback({ success: true });
    });

    socket.on('playTiles', (melds: Meld[], callback) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      
      if (!roomCode || !playerId) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const game = roomManager.getGame(roomCode);
      
      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }
      
      // Calculate new hand by removing played tiles
      const currentTiles = game.getPlayerTiles(playerId);
      const tilesOnBoard = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
      const newHand = currentTiles.filter(t => !tilesOnBoard.has(t.id));
      
      const result = game.playTiles(playerId, melds, newHand);
      
      if (!result.success) {
        callback(result);
        return;
      }
      
      // Broadcast updated state to all players by iterating room sockets
      const roomSockets = io.sockets.adapter.rooms.get(roomCode);
      if (roomSockets) {
        for (const socketId of roomSockets) {
          const playerSocket = io.sockets.sockets.get(socketId);
          if (playerSocket && playerSocket.data.playerId) {
            const state = game.getState(roomCode);
            const tiles = game.getPlayerTiles(playerSocket.data.playerId);
            playerSocket.emit('gameUpdate', state, tiles);
          }
        }
      }
      
      // Check for winner
      if (game.isGameOver()) {
        const winnerId = game.getWinner();
        const winnerName = game.getWinnerName();
        if (winnerId && winnerName) {
          io.to(roomCode).emit('gameOver', winnerId, winnerName);
          roomManager.endGame(roomCode);
        }
      }
      
      callback({ success: true });
    });

    socket.on('drawTile', (callback) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      
      if (!roomCode || !playerId) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const game = roomManager.getGame(roomCode);
      
      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }
      
      const result = game.drawTile(playerId);
      
      if (!result.success) {
        callback(result);
        return;
      }
      
      // Broadcast updated state to all players by iterating room sockets
      const roomSockets = io.sockets.adapter.rooms.get(roomCode);
      if (roomSockets) {
        for (const socketId of roomSockets) {
          const playerSocket = io.sockets.sockets.get(socketId);
          if (playerSocket && playerSocket.data.playerId) {
            const state = game.getState(roomCode);
            const tiles = game.getPlayerTiles(playerSocket.data.playerId);
            playerSocket.emit('gameUpdate', state, tiles);
          }
        }
      }
      
      callback({ success: true });
    });

    socket.on('undoTurn', (callback) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      
      if (!roomCode || !playerId) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const game = roomManager.getGame(roomCode);
      
      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }
      
      const result = game.undoTurn();
      
      if (!result.success) {
        callback(result);
        return;
      }
      
      // Send updated state only to the current player
      const state = game.getState(roomCode);
      const tiles = game.getPlayerTiles(playerId);
      socket.emit('gameUpdate', state, tiles);
      
      callback({ success: true });
    });

    socket.on('reconnect', (playerId, roomCode) => {
      console.log(`Player attempting reconnect: ${playerId} to room ${roomCode}`);
      
      const result = roomManager.reconnectPlayer(playerId, roomCode, socket.id);
      
      if (!result.success) {
        socket.emit('reconnectFailed', result.error || 'Reconnection failed');
        return;
      }
      
      // Update socket data
      socket.data.playerId = playerId;
      socket.data.roomCode = roomCode;
      
      // Get player name from room
      const room = result.room;
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          socket.data.playerName = player.name;
        }
      }
      
      // Join the socket.io room
      socket.join(roomCode);
      
      // Send reconnected event with full state
      socket.emit('reconnected', {
        room: result.room!,
        gameState: result.gameState,
        tiles: result.tiles,
      });
      
      // Notify other players that this player reconnected
      if (result.room) {
        io.to(roomCode).emit('roomUpdate', result.room);
      }
      
      console.log(`Player ${playerId} reconnected successfully`);
    });

    // WebRTC signaling: relay signal to target player
    socket.on('signal', (targetPlayerId, signalData) => {
      const targetSocketId = roomManager.getSocketIdByPlayerId(targetPlayerId);
      const senderRoomCode = socket.data.roomCode;
      
      if (targetSocketId && socket.data.playerId) {
        // Verify both players are in the same room
        const targetPlayerRoom = roomManager.getPlayerRoom(targetPlayerId);
        if (targetPlayerRoom === senderRoomCode) {
          io.to(targetSocketId).emit('peerSignal', socket.data.playerId, signalData);
        }
      }
    });

    // WebRTC: broadcast media state change to room
    socket.on('mediaStateChange', (state) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      
      if (roomCode && playerId) {
        // Broadcast to all other players in the room
        socket.to(roomCode).emit('peerMediaState', playerId, state);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      
      if (roomCode && playerId) {
        // Notify other players about peer leaving (for WebRTC cleanup)
        socket.to(roomCode).emit('peerLeft', playerId);
        
        roomManager.setPlayerConnected(playerId, false);
        roomManager.removeSocketMapping(socket.id);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('roomUpdate', room);
        }
      }
    });
  });
}
