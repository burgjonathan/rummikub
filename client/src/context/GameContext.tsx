import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import type { GameState, Room, Tile, Meld, Player } from 'shared';
import { useSocket } from './SocketContext';

// Session persistence helpers
const SESSION_KEY = 'rummikub_session';

interface SessionData {
  playerId: string;
  roomCode: string;
  playerName: string;
}

function saveSession(data: SessionData): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession(): SessionData | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

interface GameContextType {
  // Room state
  room: Room | null;
  isHost: boolean;
  playerId: string | null;
  playerName: string | null;
  isReconnecting: boolean;
  
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
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const reconnectAttemptedRef = useRef(false);

  // Attempt reconnection when socket connects
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    // Only attempt reconnection once per socket connection
    if (reconnectAttemptedRef.current) return;
    
    const session = loadSession();
    if (session) {
      console.log('Attempting to reconnect to room:', session.roomCode);
      reconnectAttemptedRef.current = true;
      setIsReconnecting(true);
      setPlayerName(session.playerName);
      socket.emit('reconnect', session.playerId, session.roomCode);
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

    // Handle receiving stable playerId after joining/creating room
    socket.on('roomJoined', (stablePlayerId) => {
      console.log('Received stable playerId:', stablePlayerId);
      setPlayerId(stablePlayerId);
    });
    
    // Reset reconnect flag when socket disconnects
    socket.on('disconnect', () => {
      reconnectAttemptedRef.current = false;
    });

    // Handle successful reconnection
    socket.on('reconnected', (data) => {
      console.log('Reconnected successfully:', data);
      setIsReconnecting(false);
      setRoom(data.room);
      
      // Find our playerId from the room
      const session = loadSession();
      if (session) {
        setPlayerId(session.playerId);
      }
      
      if (data.gameState) {
        setGameState(data.gameState);
      }
      if (data.tiles) {
        setMyTiles(data.tiles);
      }
    });

    // Handle failed reconnection
    socket.on('reconnectFailed', (reason) => {
      console.log('Reconnection failed:', reason);
      setIsReconnecting(false);
      clearSession();
      // Reset state to show lobby
      setRoom(null);
      setGameState(null);
      setMyTiles([]);
      setPlayerId(null);
      setPlayerName(null);
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('gameStart');
      socket.off('gameUpdate');
      socket.off('gameOver');
      socket.off('error');
      socket.off('roomJoined');
      socket.off('reconnected');
      socket.off('reconnectFailed');
      socket.off('disconnect');
    };
  }, [socket]);

  // Save session when we have all required data
  useEffect(() => {
    if (playerId && room && playerName && !isReconnecting) {
      saveSession({
        playerId,
        roomCode: room.code,
        playerName,
      });
      console.log('Session saved:', { playerId, roomCode: room.code, playerName });
    }
  }, [playerId, room, playerName, isReconnecting]);

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
    clearSession();
    setRoom(null);
    setGameState(null);
    setMyTiles([]);
    setPlayerId(null);
    setPlayerName(null);
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
        isReconnecting,
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
