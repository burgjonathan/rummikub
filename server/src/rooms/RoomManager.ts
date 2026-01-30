import type { Room, RoomStatus, Player } from 'shared';
import { nanoid } from 'nanoid';
import { Game } from '../game/GameState.js';

const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

interface RoomData {
  code: string;
  players: Map<string, { id: string; name: string; isConnected: boolean }>;
  hostId: string;
  status: RoomStatus;
  game: Game | null;
}

export class RoomManager {
  private rooms: Map<string, RoomData> = new Map();
  private playerToRoom: Map<string, string> = new Map();

  private generateRoomCode(): string {
    // Generate a 6-character alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  createRoom(hostId: string, hostName: string): string {
    const code = this.generateRoomCode();
    
    const room: RoomData = {
      code,
      players: new Map([[hostId, { id: hostId, name: hostName, isConnected: true }]]),
      hostId,
      status: 'waiting',
      game: null,
    };
    
    this.rooms.set(code, room);
    this.playerToRoom.set(hostId, code);
    
    return code;
  }

  joinRoom(roomCode: string, playerId: string, playerName: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    if (room.status !== 'waiting') {
      return { success: false, error: 'Game already in progress' };
    }
    
    if (room.players.size >= MAX_PLAYERS) {
      return { success: false, error: 'Room is full' };
    }
    
    room.players.set(playerId, { id: playerId, name: playerName, isConnected: true });
    this.playerToRoom.set(playerId, roomCode);
    
    return { success: true };
  }

  leaveRoom(playerId: string): void {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return;
    
    const room = this.rooms.get(roomCode);
    if (!room) return;
    
    room.players.delete(playerId);
    this.playerToRoom.delete(playerId);
    
    // If room is empty, delete it
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return;
    }
    
    // If host left, assign new host
    if (room.hostId === playerId) {
      room.hostId = room.players.keys().next().value!;
    }
    
    // If game is in progress, remove player from game
    if (room.game) {
      room.game.removePlayer(playerId);
    }
  }

  setPlayerConnected(playerId: string, connected: boolean): void {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return;
    
    const room = this.rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.get(playerId);
    if (player) {
      player.isConnected = connected;
    }
    
    if (room.game) {
      room.game.setPlayerConnected(playerId, connected);
    }
  }

  startGame(roomCode: string, requesterId: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    if (room.hostId !== requesterId) {
      return { success: false, error: 'Only the host can start the game' };
    }
    
    if (room.players.size < MIN_PLAYERS) {
      return { success: false, error: `Need at least ${MIN_PLAYERS} players to start` };
    }
    
    if (room.status !== 'waiting') {
      return { success: false, error: 'Game already started' };
    }
    
    // Create and initialize game
    room.game = new Game();
    
    for (const [id, player] of room.players) {
      room.game.addPlayer(id, player.name);
    }
    
    room.status = 'playing';
    room.game.startTurn();
    
    return { success: true };
  }

  getRoom(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    
    const players: Player[] = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      tileCount: room.game?.getPlayerTiles(p.id).length ?? 0,
      isConnected: p.isConnected,
      hasInitialMeld: false, // Will be updated from game state
    }));
    
    return {
      code: room.code,
      players,
      hostId: room.hostId,
      status: room.status,
      maxPlayers: MAX_PLAYERS,
    };
  }

  getGame(roomCode: string): Game | null {
    return this.rooms.get(roomCode)?.game ?? null;
  }

  getPlayerRoom(playerId: string): string | null {
    return this.playerToRoom.get(playerId) ?? null;
  }

  getRoomPlayers(roomCode: string): string[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return Array.from(room.players.keys());
  }

  endGame(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.status = 'finished';
    }
  }
}

// Singleton instance
export const roomManager = new RoomManager();
