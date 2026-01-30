import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';

export default function Lobby() {
  const { code: inviteCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isConnected } = useSocket();
  const {
    room,
    isHost,
    playerId,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    error,
    clearError,
  } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(inviteCode || '');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>(inviteCode ? 'join' : 'menu');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Handle invite link
  useEffect(() => {
    if (inviteCode) {
      setRoomCode(inviteCode);
      setMode('join');
    }
  }, [inviteCode]);

  // Navigate to game when game starts
  useEffect(() => {
    if (room?.status === 'playing') {
      navigate('/game');
    }
  }, [room?.status, navigate]);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setLocalError('Please enter your name');
      return;
    }

    setLoading(true);
    setLocalError(null);
    
    try {
      await createRoom(playerName.trim());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setLocalError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setLocalError('Please enter a room code');
      return;
    }

    setLoading(true);
    setLocalError(null);
    
    try {
      await joinRoom(roomCode.trim(), playerName.trim());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    setLocalError(null);
    
    try {
      await startGame();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    setMode('menu');
  };

  const copyInviteLink = () => {
    if (room) {
      const link = `${window.location.origin}/join/${room.code}`;
      navigator.clipboard.writeText(link);
    }
  };

  const displayError = localError || error;

  // Waiting room view
  if (room) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Rummikub
          </h1>
          <div className="text-center mb-6">
            <p className="text-gray-500 mb-2">Room Code</p>
            <p className="text-4xl font-mono font-bold text-emerald-600 tracking-widest">
              {room.code}
            </p>
          </div>

          <button
            onClick={copyInviteLink}
            className="w-full mb-6 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Invite Link
          </button>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Players ({room.players.length}/{room.maxPlayers})
            </h2>
            <ul className="space-y-2">
              {room.players.map((player) => (
                <li
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.id === playerId
                      ? 'bg-emerald-100 border-2 border-emerald-300'
                      : 'bg-gray-100'
                  }`}
                >
                  <span className="font-medium text-gray-800">
                    {player.name}
                    {player.id === room.hostId && (
                      <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                        Host
                      </span>
                    )}
                    {player.id === playerId && (
                      <span className="ml-2 text-xs text-gray-500">(You)</span>
                    )}
                  </span>
                  <span
                    className={`w-3 h-3 rounded-full ${
                      player.isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                </li>
              ))}
            </ul>
          </div>

          {displayError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {displayError}
            </div>
          )}

          <div className="space-y-3">
            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={loading || room.players.length < 2}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
              >
                {loading ? 'Starting...' : room.players.length < 2 ? 'Need 2+ Players' : 'Start Game'}
              </button>
            )}
            {!isHost && (
              <p className="text-center text-gray-500 py-3">
                Waiting for host to start the game...
              </p>
            )}
            <button
              onClick={handleLeave}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Menu / Create / Join views
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-2">
          Rummikub
        </h1>
        <p className="text-center text-gray-500 mb-8">
          {!isConnected ? 'Connecting...' : 'Multiplayer Game'}
        </p>

        {displayError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
            {displayError}
            <button
              onClick={() => {
                setLocalError(null);
                clearError();
              }}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {mode === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              disabled={!isConnected}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!isConnected}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors text-lg"
            >
              Join Game
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-800"
                maxLength={20}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={loading || !isConnected}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD12"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 font-mono text-center text-xl tracking-widest uppercase"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading || !isConnected}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
            <button
              onClick={() => {
                setMode('menu');
                setRoomCode('');
              }}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
