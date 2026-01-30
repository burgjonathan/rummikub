import type { Player } from 'shared';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
  myPlayerId: string | null;
}

export default function PlayerList({ players, currentPlayerId, myPlayerId }: PlayerListProps) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg sm:rounded-xl p-2 sm:p-4 h-full">
      <h3 className="text-white/80 font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Players</h3>
      <ul className="space-y-1 sm:space-y-2">
        {players.map((player) => (
          <li
            key={player.id}
            className={`
              flex items-center justify-between p-1.5 sm:p-2 rounded-lg
              transition-all duration-200
              ${player.id === currentPlayerId
                ? 'bg-emerald-500/30 ring-2 ring-emerald-400'
                : 'bg-white/5'
              }
            `}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  player.isConnected ? 'bg-green-400' : 'bg-gray-500'
                }`}
              />
              <span className="text-white font-medium text-xs sm:text-sm truncate">
                {player.name}
                {player.id === myPlayerId && (
                  <span className="ml-1 text-white/50 text-xs">(You)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <span className="text-white/60 text-xs sm:text-sm whitespace-nowrap">
                {player.tileCount} tiles
              </span>
              {player.id === currentPlayerId && (
                <span className="text-[10px] sm:text-xs bg-emerald-500 text-white px-1.5 sm:px-2 py-0.5 rounded-full animate-pulse">
                  Turn
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
