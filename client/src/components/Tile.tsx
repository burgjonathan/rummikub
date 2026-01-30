import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Tile as TileType } from 'shared';

interface TileProps {
  tile: TileType;
  isDragging?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

const colorClasses: Record<string, string> = {
  red: 'text-red-600',
  blue: 'text-blue-600',
  yellow: 'text-yellow-600',
  black: 'text-gray-800',
};

export function TileComponent({ tile, isDragging, isSelected, onClick }: TileProps) {
  return (
    <div
      onClick={onClick}
      className={`
        w-12 h-16 bg-amber-50 rounded-lg border-2 flex items-center justify-center
        font-bold text-2xl shadow-md cursor-pointer select-none
        transition-all duration-150
        ${isDragging ? 'opacity-50 scale-105' : ''}
        ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}
        ${tile.isJoker ? 'border-purple-400' : 'border-amber-200'}
        hover:border-amber-400 hover:shadow-lg
      `}
    >
      {tile.isJoker ? (
        <span className="text-xl">🃏</span>
      ) : (
        <span className={colorClasses[tile.color]}>{tile.number}</span>
      )}
    </div>
  );
}

interface DraggableTileProps {
  tile: TileType;
  isSelected?: boolean;
  onClick?: () => void;
}

export function DraggableTile({ tile, isSelected, onClick }: DraggableTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tile.id,
    data: { tile },
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 1000 : undefined,
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TileComponent tile={tile} isDragging={isDragging} isSelected={isSelected} onClick={onClick} />
    </div>
  );
}

export default TileComponent;
