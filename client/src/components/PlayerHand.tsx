import { useDroppable } from '@dnd-kit/core';
import type { Tile } from 'shared';
import { DraggableTile } from './Tile';

interface PlayerHandProps {
  tiles: Tile[];
  selectedTileIds: Set<string>;
  onTileSelect: (tileId: string) => void;
  isMyTurn: boolean;
}

export default function PlayerHand({
  tiles,
  selectedTileIds,
  onTileSelect,
  isMyTurn,
}: PlayerHandProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'player-hand',
    data: { type: 'hand' },
  });

  // Sort tiles by color then number
  const sortedTiles = [...tiles].sort((a, b) => {
    if (a.isJoker && !b.isJoker) return 1;
    if (!a.isJoker && b.isJoker) return -1;
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return a.number - b.number;
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        bg-amber-800/80 backdrop-blur rounded-2xl p-4 shadow-xl
        transition-all duration-200
        ${isOver ? 'ring-4 ring-amber-400' : ''}
        ${!isMyTurn ? 'opacity-75' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Your Tiles ({tiles.length})</h3>
        {!isMyTurn && (
          <span className="text-amber-300 text-sm">Wait for your turn</span>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2 min-h-[80px]">
        {sortedTiles.map((tile) => (
          <DraggableTile
            key={tile.id}
            tile={tile}
            isSelected={selectedTileIds.has(tile.id)}
            onClick={() => onTileSelect(tile.id)}
          />
        ))}
        {tiles.length === 0 && (
          <div className="flex items-center justify-center w-full text-amber-300/50 italic">
            No tiles
          </div>
        )}
      </div>
    </div>
  );
}
