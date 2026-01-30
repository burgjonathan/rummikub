import type { Tile, Meld, TileColor } from 'shared';
import { TILE_COLORS } from './Tile.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Check if tiles form a valid run (same color, consecutive numbers)
export function isValidRun(tiles: Tile[]): boolean {
  if (tiles.length < 3) return false;
  
  // Get non-joker tiles to determine the color
  const nonJokers = tiles.filter(t => !t.isJoker);
  if (nonJokers.length === 0) return true; // All jokers is technically valid
  
  // All non-joker tiles must be the same color
  const color = nonJokers[0].color;
  if (!nonJokers.every(t => t.color === color)) return false;
  
  // Sort tiles by number (jokers will be placed where needed)
  const sortedNonJokers = [...nonJokers].sort((a, b) => a.number - b.number);
  
  // Check for duplicates in non-joker tiles
  for (let i = 1; i < sortedNonJokers.length; i++) {
    if (sortedNonJokers[i].number === sortedNonJokers[i - 1].number) {
      return false;
    }
  }
  
  // Calculate the range and check if jokers can fill gaps
  const minNum = sortedNonJokers[0].number;
  const maxNum = sortedNonJokers[sortedNonJokers.length - 1].number;
  const jokerCount = tiles.length - nonJokers.length;
  
  // The run must be consecutive from min to max
  const expectedLength = maxNum - minNum + 1;
  
  // Check if the range is valid (1-13)
  if (minNum < 1 || maxNum > 13) return false;
  
  // We need exactly expectedLength tiles
  // jokerCount should fill in the gaps
  const gaps = expectedLength - nonJokers.length;
  
  if (gaps < 0 || gaps > jokerCount) return false;
  
  // If we have extra jokers, they extend the run
  const extraJokers = jokerCount - gaps;
  
  // Check if extending is valid (can't go below 1 or above 13)
  const potentialMin = minNum - extraJokers;
  const potentialMax = maxNum + extraJokers;
  
  // At least one valid extension must exist
  // Try extending left first, then right
  let leftExtend = Math.max(0, 1 - potentialMin < 0 ? extraJokers : Math.min(extraJokers, minNum - 1));
  let rightExtend = extraJokers - leftExtend;
  
  if (maxNum + rightExtend > 13) {
    // Too many jokers to extend right, try more left
    rightExtend = 13 - maxNum;
    leftExtend = extraJokers - rightExtend;
    if (minNum - leftExtend < 1) return false;
  }
  
  return tiles.length === expectedLength + extraJokers;
}

// Check if tiles form a valid group (same number, different colors)
export function isValidGroup(tiles: Tile[]): boolean {
  if (tiles.length < 3 || tiles.length > 4) return false;
  
  const nonJokers = tiles.filter(t => !t.isJoker);
  if (nonJokers.length === 0) return true; // All jokers
  
  // All non-joker tiles must have the same number
  const number = nonJokers[0].number;
  if (!nonJokers.every(t => t.number === number)) return false;
  
  // All non-joker tiles must have different colors
  const colors = new Set(nonJokers.map(t => t.color));
  if (colors.size !== nonJokers.length) return false;
  
  // Total tiles can't exceed 4 (one per color)
  return tiles.length <= 4;
}

// Check if a meld is valid (either run or group)
export function isValidMeld(meld: Meld): boolean {
  return isValidRun(meld.tiles) || isValidGroup(meld.tiles);
}

// Validate all melds on the board
export function validateBoard(melds: Meld[]): ValidationResult {
  for (const meld of melds) {
    if (!isValidMeld(meld)) {
      return {
        valid: false,
        error: `Invalid meld: ${meld.tiles.map(t => t.isJoker ? 'J' : `${t.color[0]}${t.number}`).join(', ')}`,
      };
    }
  }
  return { valid: true };
}

// Calculate the point value of tiles (for initial meld requirement)
export function calculateMeldPoints(tiles: Tile[]): number {
  // Jokers take the value of the tile they represent
  if (isValidRun(tiles)) {
    return calculateRunPoints(tiles);
  } else if (isValidGroup(tiles)) {
    return calculateGroupPoints(tiles);
  }
  return 0;
}

function calculateRunPoints(tiles: Tile[]): number {
  const nonJokers = tiles.filter(t => !t.isJoker).sort((a, b) => a.number - b.number);
  if (nonJokers.length === 0) return 0;
  
  const minNum = nonJokers[0].number;
  let total = 0;
  
  for (let i = 0; i < tiles.length; i++) {
    total += minNum + i;
  }
  
  return total;
}

function calculateGroupPoints(tiles: Tile[]): number {
  const nonJokers = tiles.filter(t => !t.isJoker);
  if (nonJokers.length === 0) return 0;
  
  const number = nonJokers[0].number;
  return number * tiles.length;
}

// Calculate total points for initial meld validation
export function calculateTotalPoints(melds: Meld[]): number {
  return melds.reduce((total, meld) => total + calculateMeldPoints(meld.tiles), 0);
}
