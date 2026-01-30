import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Meld } from 'shared';
import { roomManager } from '../rooms/RoomManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function setupSocketHandlers(io: TypedServer): void {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('createRoom', (playerName, callback) => {
      try {
        const roomCode = roomManager.createRoom(socket.id, playerName);
        socket.data.playerId = socket.id;
        socket.data.playerName = playerName;
        socket.data.roomCode = roomCode;
        
        socket.join(roomCode);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          socket.emit('roomUpdate', room);
        }
        
        callback({ success: true, roomCode });
      } catch (error) {
        callback({ success: false, error: 'Failed to create room' });
      }
    });

    socket.on('joinRoom', (roomCode, playerName, callback) => {
      try {
        const result = roomManager.joinRoom(roomCode, socket.id, playerName);
        
        if (!result.success) {
          callback(result);
          return;
        }
        
        socket.data.playerId = socket.id;
        socket.data.playerName = playerName;
        socket.data.roomCode = roomCode;
        
        socket.join(roomCode);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('roomUpdate', room);
        }
        
        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: 'Failed to join room' });
      }
    });

    socket.on('leaveRoom', () => {
      const roomCode = socket.data.roomCode;
      if (roomCode) {
        roomManager.leaveRoom(socket.id);
        socket.leave(roomCode);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('roomUpdate', room);
        }
        
        socket.data.roomCode = null;
      }
    });

    socket.on('startGame', (callback) => {
      const roomCode = socket.data.roomCode;
      
      if (!roomCode) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const result = roomManager.startGame(roomCode, socket.id);
      
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
      
      // Send game state to each player
      const playerIds = roomManager.getRoomPlayers(roomCode);
      for (const playerId of playerIds) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          const state = game.getState(roomCode);
          const tiles = game.getPlayerTiles(playerId);
          playerSocket.emit('gameStart', state, tiles);
        }
      }
      
      io.to(roomCode).emit('roomUpdate', room);
      callback({ success: true });
    });

    socket.on('playTiles', (melds: Meld[], callback) => {
      const roomCode = socket.data.roomCode;
      
      if (!roomCode) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const game = roomManager.getGame(roomCode);
      
      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }
      
      // Calculate new hand by removing played tiles
      const currentTiles = game.getPlayerTiles(socket.id);
      const tilesOnBoard = new Set(melds.flatMap(m => m.tiles.map(t => t.id)));
      const newHand = currentTiles.filter(t => !tilesOnBoard.has(t.id));
      
      const result = game.playTiles(socket.id, melds, newHand);
      
      if (!result.success) {
        callback(result);
        return;
      }
      
      // Broadcast updated state to all players
      const playerIds = roomManager.getRoomPlayers(roomCode);
      for (const playerId of playerIds) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          const state = game.getState(roomCode);
          const tiles = game.getPlayerTiles(playerId);
          playerSocket.emit('gameUpdate', state, tiles);
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
      
      if (!roomCode) {
        callback({ success: false, error: 'Not in a room' });
        return;
      }
      
      const game = roomManager.getGame(roomCode);
      
      if (!game) {
        callback({ success: false, error: 'Game not found' });
        return;
      }
      
      const result = game.drawTile(socket.id);
      
      if (!result.success) {
        callback(result);
        return;
      }
      
      // Broadcast updated state to all players
      const playerIds = roomManager.getRoomPlayers(roomCode);
      for (const playerId of playerIds) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          const state = game.getState(roomCode);
          const tiles = game.getPlayerTiles(playerId);
          playerSocket.emit('gameUpdate', state, tiles);
        }
      }
      
      callback({ success: true });
    });

    socket.on('undoTurn', (callback) => {
      const roomCode = socket.data.roomCode;
      
      if (!roomCode) {
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
      const tiles = game.getPlayerTiles(socket.id);
      socket.emit('gameUpdate', state, tiles);
      
      callback({ success: true });
    });

    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      
      const roomCode = socket.data.roomCode;
      if (roomCode) {
        roomManager.setPlayerConnected(socket.id, false);
        
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(roomCode).emit('roomUpdate', room);
        }
      }
    });
  });
}
