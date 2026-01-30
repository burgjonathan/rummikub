import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { GameState, Room, Tile, Meld, Player } from 'shared';
import { useSocket } from './SocketContext';

interface GameContextType {
  // Room state
  room: Room | null;
  isHost: boolean;
  playerId: string | null;
  playerName: string | null;
  
  // Game state
  gameState: GameState | null;
  myTiles: Tile[];
  isMyTurn: boolean;
  
  // Actions
  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => Promise<void>;
  leaveRoom: () => void;
  startGame: () => Promise<void>;
  playTiles: (melds: Meld[]) => Promise<void>;
  drawTile: () => Promise<void>;
  undoTurn: () => Promise<void>;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { socket, isConnected } = useSocket();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myTiles, setMyTiles] = useState<Tile[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set player ID from socket
  useEffect(() => {
    if (socket && isConnected) {
      setPlayerId(socket.id ?? null);
    }
  }, [socket, isConnected]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('roomUpdate', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    socket.on('gameStart', (state, tiles) => {
      setGameState(state);
      setMyTiles(tiles);
    });

    socket.on('gameUpdate', (state, tiles) => {
      setGameState(state);
      setMyTiles(tiles);
    });

    socket.on('gameOver', (winnerId, winnerName) => {
      setGameState(prev => prev ? { ...prev, winner: winnerId } : null);
    });

    socket.on('error', (message) => {
      setError(message);
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('gameStart');
      socket.off('gameUpdate');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [socket]);

  const createRoom = useCallback(async (name: string): Promise<string> => {
    if (!socket) throw new Error('Not connected');
    setPlayerName(name);
    
    return new Promise((resolve, reject) => {
      socket.emit('createRoom', name, (response) => {
        if (response.success && response.roomCode) {
          resolve(response.roomCode);
        } else {
          reject(new Error(response.error || 'Failed to create room'));
        }
      });
    });
  }, [socket]);

  const joinRoom = useCallback(async (roomCode: string, name: string): Promise<void> => {
    if (!socket) throw new Error('Not connected');
    setPlayerName(name);
    
    return new Promise((resolve, reject) => {
      socket.emit('joinRoom', roomCode.toUpperCase(), name, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (!socket) return;
    socket.emit('leaveRoom');
    setRoom(null);
    setGameState(null);
    setMyTiles([]);
  }, [socket]);

  const startGame = useCallback(async (): Promise<void> => {
    if (!socket) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      socket.emit('startGame', (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to start game'));
        }
      });
    });
  }, [socket]);

  const playTiles = useCallback(async (melds: Meld[]): Promise<void> => {
    if (!socket) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      socket.emit('playTiles', melds, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Invalid move'));
        }
      });
    });
  }, [socket]);

  const drawTile = useCallback(async (): Promise<void> => {
    if (!socket) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      socket.emit('drawTile', (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Cannot draw tile'));
        }
      });
    });
  }, [socket]);

  const undoTurn = useCallback(async (): Promise<void> => {
    if (!socket) throw new Error('Not connected');
    
    return new Promise((resolve, reject) => {
      socket.emit('undoTurn', (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Cannot undo'));
        }
      });
    });
  }, [socket]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isHost = room?.hostId === playerId;
  const isMyTurn = gameState?.currentPlayerId === playerId;

  return (
    <GameContext.Provider
      value={{
        room,
        isHost,
        playerId,
        playerName,
        gameState,
        myTiles,
        isMyTurn,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        playTiles,
        drawTile,
        undoTurn,
        error,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
