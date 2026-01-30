// Tile colors
export type TileColor = 'red' | 'blue' | 'yellow' | 'black';

// Tile representation
export interface Tile {
  id: string;
  color: TileColor;
  number: number; // 1-13, 0 for joker
  isJoker: boolean;
}

// A meld is a valid group or run of tiles on the board
export interface Meld {
  id: string;
  tiles: Tile[];
}

// Player state (what's visible to that player)
export interface Player {
  id: string;
  name: string;
  tileCount: number; // Other players only see count
  isConnected: boolean;
  hasInitialMeld: boolean; // Has played 30+ points initial meld
}

// Player's own state (includes their tiles)
export interface PlayerSelf extends Player {
  tiles: Tile[];
}

// Room states
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// Room information
export interface Room {
  code: string;
  players: Player[];
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
}

// Full game state sent to players
export interface GameState {
  roomCode: string;
  players: Player[];
  currentPlayerId: string;
  board: Meld[];
  pool: number; // Number of tiles remaining in pool
  turnStartBoard: Meld[]; // Board state at start of turn (for undo)
  winner: string | null;
}

// Events from client to server
export interface ClientToServerEvents {
  createRoom: (playerName: string, callback: (response: { success: boolean; roomCode?: string; error?: string }) => void) => void;
  joinRoom: (roomCode: string, playerName: string, callback: (response: { success: boolean; error?: string }) => void) => void;
  leaveRoom: () => void;
  startGame: (callback: (response: { success: boolean; error?: string }) => void) => void;
  playTiles: (melds: Meld[], callback: (response: { success: boolean; error?: string }) => void) => void;
  drawTile: (callback: (response: { success: boolean; error?: string }) => void) => void;
  undoTurn: (callback: (response: { success: boolean; error?: string }) => void) => void;
  reconnect: (playerId: string, roomCode: string) => void;
}

// Events from server to client
export interface ServerToClientEvents {
  roomUpdate: (room: Room) => void;
  gameStart: (state: GameState, yourTiles: Tile[]) => void;
  gameUpdate: (state: GameState, yourTiles: Tile[]) => void;
  gameOver: (winnerId: string, winnerName: string) => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  error: (message: string) => void;
  roomJoined: (playerId: string) => void;
  reconnected: (data: { room: Room; gameState?: GameState; tiles?: Tile[] }) => void;
  reconnectFailed: (reason: string) => void;
}

// Socket data stored on each socket
export interface SocketData {
  playerId: string;
  playerName: string;
  roomCode: string | null;
}
