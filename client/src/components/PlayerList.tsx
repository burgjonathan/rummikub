import type { Player } from 'shared';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string;
  myPlayerId: string | null;
}

export default function PlayerList({ players, currentPlayerId, myPlayerId }: PlayerListProps) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-4">
      <h3 className="text-white/80 font-semibold mb-3">Players</h3>
      <ul className="space-y-2">
        {players.map((player) => (
          <li
            key={player.id}
            className={`
              flex items-center justify-between p-2 rounded-lg
              transition-all duration-200
              ${player.id === currentPlayerId
                ? 'bg-emerald-500/30 ring-2 ring-emerald-400'
                : 'bg-white/5'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  player.isConnected ? 'bg-green-400' : 'bg-gray-500'
                }`}
              />
              <span className="text-white font-medium">
                {player.name}
                {player.id === myPlayerId && (
                  <span className="ml-1 text-white/50 text-sm">(You)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">
                {player.tileCount} tiles
              </span>
              {player.id === currentPlayerId && (
                <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">
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
