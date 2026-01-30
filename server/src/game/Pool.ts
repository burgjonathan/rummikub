import type { Tile } from 'shared';
import { createTile, createJoker, TILE_COLORS, TILE_NUMBERS } from './Tile.js';

export class Pool {
  private tiles: Tile[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.tiles = [];
    
    // Create 2 sets of numbered tiles (1-13 in 4 colors)
    for (let set = 0; set < 2; set++) {
      for (const color of TILE_COLORS) {
        for (const number of TILE_NUMBERS) {
          this.tiles.push(createTile(color, number));
        }
      }
    }
    
    // Add 2 jokers
    this.tiles.push(createJoker());
    this.tiles.push(createJoker());
    
    // Shuffle the pool
    this.shuffle();
  }

  private shuffle(): void {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  draw(): Tile | null {
    return this.tiles.pop() ?? null;
  }

  drawMultiple(count: number): Tile[] {
    const drawn: Tile[] = [];
    for (let i = 0; i < count; i++) {
      const tile = this.draw();
      if (tile) {
        drawn.push(tile);
      }
    }
    return drawn;
  }

  returnTile(tile: Tile): void {
    this.tiles.push(tile);
    this.shuffle();
  }

  get size(): number {
    return this.tiles.length;
  }

  isEmpty(): boolean {
    return this.tiles.length === 0;
  }
}
