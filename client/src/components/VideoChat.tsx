import { useEffect, useRef } from 'react';
import { useMedia } from '../context/MediaContext';
import { useGame } from '../context/GameContext';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

function VideoTile({ stream, name, isLocal = false, isMuted = false, isVideoOff = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative bg-gray-800 rounded-md sm:rounded-lg overflow-hidden aspect-video min-w-[80px]">
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'transform scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-700">
          <div className="w-8 h-8 sm:w-16 sm:h-16 rounded-full bg-gray-600 flex items-center justify-center text-sm sm:text-xl font-bold text-gray-300">
            {initials}
          </div>
        </div>
      )}
      
      {/* Name badge */}
      <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 bg-black/60 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-sm text-white flex items-center gap-1 sm:gap-2">
        {isLocal && <span className="text-[8px] sm:text-xs text-gray-400">(You)</span>}
        <span className="truncate max-w-[50px] sm:max-w-none">{name}</span>
        {isMuted && (
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
      </div>
      
      {isLocal && (
        <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-blue-500/80 px-1 sm:px-2 py-0.5 rounded text-[8px] sm:text-xs text-white">
          LIVE
        </div>
      )}
    </div>
  );
}

export function VideoChat() {
  const { 
    localStream, 
    remoteStreams, 
    isMediaActive,
    isVideoEnabled,
    isAudioEnabled,
    peerMediaStates,
  } = useMedia();
  
  const { room, playerId, playerName } = useGame();

  if (!isMediaActive || !room) {
    return null;
  }

  // Get player names for remote streams
  const getPlayerName = (id: string): string => {
    const player = room.players.find(p => p.id === id);
    return player?.name || 'Unknown';
  };

  const remoteEntries = Array.from(remoteStreams.entries());
  const totalParticipants = remoteEntries.length + 1; // +1 for local

  // Determine grid layout based on participant count
  const getGridCols = () => {
    if (totalParticipants <= 1) return 'grid-cols-1';
    if (totalParticipants <= 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className={`grid gap-2 ${getGridCols()}`}>
      {/* Local video */}
      <VideoTile
        stream={localStream}
        name={playerName || 'You'}
        isLocal
        isVideoOff={!isVideoEnabled}
        isMuted={!isAudioEnabled}
      />
      
      {/* Remote videos */}
      {remoteEntries.map(([peerId, stream]) => {
        const peerState = peerMediaStates.get(peerId);
        return (
          <VideoTile
            key={peerId}
            stream={stream}
            name={getPlayerName(peerId)}
            isVideoOff={peerState?.video === false}
            isMuted={peerState?.audio === false}
          />
        );
      })}
    </div>
  );
}
