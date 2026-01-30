import type { Tile, Meld, GameState, Player } from 'shared';
import { nanoid } from 'nanoid';
import { Pool } from './Pool.js';
import { validateBoard, calculateTotalPoints, isValidMeld } from './MeldValidator.js';

const INITIAL_TILES = 14;
const INITIAL_MELD_POINTS = 30;

export interface PlayerState {
  id: string;
  name: string;
  tiles: Tile[];
  isConnected: boolean;
  hasInitialMeld: boolean;
}

export class Game {
  private pool: Pool;
  private players: Map<string, PlayerState>;
  private playerOrder: string[];
  private currentPlayerIndex: number;
  private board: Meld[];
  private turnStartBoard: Meld[];
  private turnStartHand: Tile[];
  private winner: string | null;

  constructor() {
    this.pool = new Pool();
    this.players = new Map();
    this.playerOrder = [];
    this.currentPlayerIndex = 0;
    this.board = [];
    this.turnStartBoard = [];
    this.turnStartHand = [];
    this.winner = null;
  }

  addPlayer(id: string, name: string): void {
    const tiles = this.pool.drawMultiple(INITIAL_TILES);
    this.players.set(id, {
      id,
      name,
      tiles,
      isConnected: true,
      hasInitialMeld: false,
    });
    this.playerOrder.push(id);
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      // Return tiles to pool
      player.tiles.forEach(tile => this.pool.returnTile(tile));
      this.players.delete(id);
      this.playerOrder = this.playerOrder.filter(pid => pid !== id);
      
      // Adjust current player index if needed
      if (this.currentPlayerIndex >= this.playerOrder.length) {
        this.currentPlayerIndex = 0;
      }
    }
  }

  setPlayerConnected(id: string, connected: boolean): void {
    const player = this.players.get(id);
    if (player) {
      player.isConnected = connected;
    }
  }

  getCurrentPlayerId(): string {
    return this.playerOrder[this.currentPlayerIndex];
  }

  private saveTurnStart(): void {
    this.turnStartBoard = JSON.parse(JSON.stringify(this.board));
    const currentPlayer = this.players.get(this.getCurrentPlayerId());
    if (currentPlayer) {
      this.turnStartHand = JSON.parse(JSON.stringify(currentPlayer.tiles));
    }
  }

  startTurn(): void {
    this.saveTurnStart();
  }

  undoTurn(): { success: boolean; error?: string } {
    const currentPlayerId = this.getCurrentPlayerId();
    const player = this.players.get(currentPlayerId);
    
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Restore board and hand to turn start state
    this.board = JSON.parse(JSON.stringify(this.turnStartBoard));
    player.tiles = JSON.parse(JSON.stringify(this.turnStartHand));
    
    return { success: true };
  }

  playTiles(playerId: string, newBoard: Meld[], newHand: Tile[]): { success: boolean; error?: string } {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'Not your turn' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Validate all melds on the new board
    const validation = validateBoard(newBoard);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check that the player used their tiles correctly
    const tilesOnBoard = newBoard.flatMap(m => m.tiles);
    const allTileIds = new Set([
      ...this.turnStartBoard.flatMap(m => m.tiles.map(t => t.id)),
      ...this.turnStartHand.map(t => t.id),
    ]);

    // Verify all tiles on new board and hand came from the starting state
    for (const tile of [...tilesOnBoard, ...newHand]) {
      if (!allTileIds.has(tile.id)) {
        return { success: false, error: 'Invalid tile detected' };
      }
    }

    // Check initial meld requirement
    if (!player.hasInitialMeld) {
      // Find new melds that are entirely from the player's hand
      const handTileIds = new Set(this.turnStartHand.map(t => t.id));
      const newMeldsFromHand = newBoard.filter(meld => 
        meld.tiles.every(tile => handTileIds.has(tile.id))
      );
      
      const points = calculateTotalPoints(newMeldsFromHand);
      if (points < INITIAL_MELD_POINTS) {
        return { 
          success: false, 
          error: `Initial meld must be at least ${INITIAL_MELD_POINTS} points (you have ${points})` 
        };
      }
      player.hasInitialMeld = true;
    }

    // Check that player played at least one tile
    const tilesPlayed = this.turnStartHand.length - newHand.length;
    if (tilesPlayed <= 0) {
      return { success: false, error: 'You must play at least one tile' };
    }

    // Update game state
    this.board = newBoard;
    player.tiles = newHand;

    // Check for winner
    if (player.tiles.length === 0) {
      this.winner = playerId;
    } else {
      this.nextTurn();
    }

    return { success: true };
  }

  drawTile(playerId: string): { success: boolean; tile?: Tile; error?: string } {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'Not your turn' };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Undo any moves made this turn
    this.undoTurn();

    const tile = this.pool.draw();
    if (!tile) {
      return { success: false, error: 'No tiles left in pool' };
    }

    player.tiles.push(tile);
    this.nextTurn();

    return { success: true, tile };
  }

  private nextTurn(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    this.saveTurnStart();
  }

  getPlayerTiles(playerId: string): Tile[] {
    return this.players.get(playerId)?.tiles ?? [];
  }

  getState(roomCode: string): GameState {
    const players: Player[] = this.playerOrder.map(id => {
      const p = this.players.get(id)!;
      return {
        id: p.id,
        name: p.name,
        tileCount: p.tiles.length,
        isConnected: p.isConnected,
        hasInitialMeld: p.hasInitialMeld,
      };
    });

    return {
      roomCode,
      players,
      currentPlayerId: this.getCurrentPlayerId(),
      board: this.board,
      pool: this.pool.size,
      turnStartBoard: this.turnStartBoard,
      winner: this.winner,
    };
  }

  isGameOver(): boolean {
    return this.winner !== null;
  }

  getWinner(): string | null {
    return this.winner;
  }

  getWinnerName(): string | null {
    if (!this.winner) return null;
    return this.players.get(this.winner)?.name ?? null;
  }
}
