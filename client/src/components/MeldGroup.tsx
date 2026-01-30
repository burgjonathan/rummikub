import { useDroppable } from '@dnd-kit/core';
import type { Meld, Tile } from 'shared';
import { DraggableTile } from './Tile';

interface MeldGroupProps {
  meld: Meld;
  selectedTileIds: Set<string>;
  onTileSelect: (tileId: string) => void;
}

export default function MeldGroup({ meld, selectedTileIds, onTileSelect }: MeldGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `meld-${meld.id}`,
    data: { type: 'meld', meldId: meld.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        inline-flex gap-1 p-2 rounded-lg bg-emerald-700/50 border-2
        transition-all duration-200
        ${isOver ? 'border-emerald-300 bg-emerald-600/50' : 'border-transparent'}
      `}
    >
      {meld.tiles.map((tile) => (
        <DraggableTile
          key={tile.id}
          tile={tile}
          isSelected={selectedTileIds.has(tile.id)}
          onClick={() => onTileSelect(tile.id)}
        />
      ))}
    </div>
  );
}
