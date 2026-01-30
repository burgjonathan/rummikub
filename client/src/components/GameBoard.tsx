import { useDroppable } from '@dnd-kit/core';
import type { Meld } from 'shared';
import MeldGroup from './MeldGroup';

interface GameBoardProps {
  melds: Meld[];
  selectedTileIds: Set<string>;
  onTileSelect: (tileId: string) => void;
  poolCount: number;
}

export default function GameBoard({
  melds,
  selectedTileIds,
  onTileSelect,
  poolCount,
}: GameBoardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'game-board',
    data: { type: 'board' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 bg-emerald-900/50 backdrop-blur rounded-2xl p-6 shadow-inner
        transition-all duration-200 min-h-[300px]
        ${isOver ? 'bg-emerald-800/60 ring-4 ring-emerald-500/50' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white/80 font-semibold">Board</h3>
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <span className="bg-emerald-800 px-3 py-1 rounded-full">
            Pool: {poolCount} tiles
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 content-start">
        {melds.map((meld) => (
          <MeldGroup
            key={meld.id}
            meld={meld}
            selectedTileIds={selectedTileIds}
            onTileSelect={onTileSelect}
          />
        ))}
        
        {melds.length === 0 && (
          <div className="flex items-center justify-center w-full h-48 text-white/30 italic text-lg">
            Drag tiles here to create melds
          </div>
        )}
      </div>
    </div>
  );
}
