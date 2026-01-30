import type { Tile, TileColor } from 'shared';
import { nanoid } from 'nanoid';

export const TILE_COLORS: TileColor[] = ['red', 'blue', 'yellow', 'black'];
export const TILE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function createTile(color: TileColor, number: number, isJoker = false): Tile {
  return {
    id: nanoid(8),
    color,
    number,
    isJoker,
  };
}

export function createJoker(): Tile {
  return {
    id: nanoid(8),
    color: 'black', // Default color, doesn't matter for jokers
    number: 0,
    isJoker: true,
  };
}

export function getTileValue(tile: Tile): number {
  if (tile.isJoker) return 0; // Jokers have no point value for initial meld
  return tile.number;
}

export function tilesEqual(a: Tile, b: Tile): boolean {
  return a.id === b.id;
}

export function cloneTile(tile: Tile): Tile {
  return { ...tile };
}
