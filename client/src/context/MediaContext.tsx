import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useEffect, 
  useRef,
  ReactNode 
} from 'react';
import Peer from 'simple-peer';
import type { MediaState } from 'shared';
import { useSocket } from './SocketContext';
import { useGame } from './GameContext';
import { useMediaDevices } from '../hooks/useMediaDevices';

interface PeerConnection {
  peer: Peer.Instance;
  playerId: string;
  stream: MediaStream | null;
  mediaState: MediaState;
}

interface MediaContextValue {
  // Local media
  localStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isMediaActive: boolean;
  
  // Remote streams
  remoteStreams: Map<string, MediaStream>;
  peerMediaStates: Map<string, MediaState>;
  
  // Device selection
  videoDevices: MediaDeviceInfo[];
  audioInputDevices: MediaDeviceInfo[];
  selectedVideoDeviceId: string | null;
  selectedAudioDeviceId: string | null;
  
  // Controls
  startMedia: () => Promise<void>;
  stopMedia: () => void;
  toggleVideo: () => void;
  toggleAudio: () => void;
  selectVideoDevice: (deviceId: string) => Promise<void>;
  selectAudioDevice: (deviceId: string) => Promise<void>;
  
  // State
  error: string | null;
  isInitializing: boolean;
}

const MediaContext = createContext<MediaContextValue | null>(null);

export function MediaProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { room, playerId } = useGame();
  const { 
    videoDevices, 
    audioInputDevices, 
    requestPermission 
  } = useMediaDevices();
  
  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMediaActive, setIsMediaActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Device selection
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);
  
  // Remote streams and peer connections
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerMediaStates, setPeerMediaStates] = useState<Map<string, MediaState>>(new Map());
  
  // Refs for peer connections (not state to avoid re-render loops)
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Get media stream with specified devices
  const getMediaStream = useCallback(async (
    videoDeviceId?: string | null,
    audioDeviceId?: string | null
  ): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints = {
      video: videoDeviceId 
        ? { deviceId: { exact: videoDeviceId } }
        : true,
      audio: audioDeviceId
        ? { deviceId: { exact: audioDeviceId } }
        : true,
    };
    
    return navigator.mediaDevices.getUserMedia(constraints);
  }, []);

  // Create peer connection for a player
  const createPeerConnection = useCallback((
    targetPlayerId: string, 
    initiator: boolean,
    stream: MediaStream
  ) => {
    if (!socket || !playerId) return null;
    
    console.log(`Creating peer connection to ${targetPlayerId}, initiator: ${initiator}`);
    
    const peer = new Peer({
      initiator,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signalData) => {
      console.log(`Sending signal to ${targetPlayerId}`);
      socket.emit('signal', targetPlayerId, signalData);
    });

    peer.on('stream', (remoteStream) => {
      console.log(`Received stream from ${targetPlayerId}`);
      setRemoteStreams(prev => new Map(prev).set(targetPlayerId, remoteStream));
    });

    peer.on('connect', () => {
      console.log(`Connected to peer ${targetPlayerId}`);
    });

    peer.on('close', () => {
      console.log(`Peer connection closed: ${targetPlayerId}`);
      peersRef.current.delete(targetPlayerId);
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(targetPlayerId);
        return next;
      });
    });

    peer.on('error', (err) => {
      console.error(`Peer error with ${targetPlayerId}:`, err);
    });

    const connection: PeerConnection = {
      peer,
      playerId: targetPlayerId,
      stream: null,
      mediaState: { video: true, audio: true },
    };

    peersRef.current.set(targetPlayerId, connection);
    return connection;
  }, [socket, playerId]);

  // Connect to all players in the room
  const connectToRoom = useCallback((stream: MediaStream) => {
    if (!room || !playerId) return;
    
    // Get other players in the room
    const otherPlayers = room.players.filter(p => p.id !== playerId && p.isConnected);
    
    for (const player of otherPlayers) {
      // Only initiate if our ID is "greater" (to avoid duplicate connections)
      const shouldInitiate = playerId > player.id;
      
      if (!peersRef.current.has(player.id)) {
        createPeerConnection(player.id, shouldInitiate, stream);
      }
    }
  }, [room, playerId, createPeerConnection]);

  // Start media and connect to peers
  const startMedia = useCallback(async () => {
    if (isMediaActive || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // Request permission first
      await requestPermission();
      
      // Get media stream
      const stream = await getMediaStream(selectedVideoDeviceId, selectedAudioDeviceId);
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMediaActive(true);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      
      // Broadcast our media state
      if (socket) {
        socket.emit('mediaStateChange', { video: true, audio: true });
      }
      
      // Connect to other players in the room
      connectToRoom(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start media';
      setError(message);
      console.error('Failed to start media:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [
    isMediaActive, 
    isInitializing, 
    requestPermission, 
    getMediaStream, 
    selectedVideoDeviceId, 
    selectedAudioDeviceId,
    socket,
    connectToRoom
  ]);

  // Stop all media
  const stopMedia = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close all peer connections
    for (const [, connection] of peersRef.current) {
      connection.peer.destroy();
    }
    peersRef.current.clear();
    
    // Reset state
    setLocalStream(null);
    setRemoteStreams(new Map());
    setPeerMediaStates(new Map());
    setIsMediaActive(false);
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
    
    // Broadcast that we stopped
    if (socket) {
      socket.emit('mediaStateChange', { video: false, audio: false });
    }
  }, [socket]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const videoTracks = localStreamRef.current.getVideoTracks();
    const newEnabled = !isVideoEnabled;
    
    videoTracks.forEach(track => {
      track.enabled = newEnabled;
    });
    
    setIsVideoEnabled(newEnabled);
    
    if (socket) {
      socket.emit('mediaStateChange', { video: newEnabled, audio: isAudioEnabled });
    }
  }, [isVideoEnabled, isAudioEnabled, socket]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    const newEnabled = !isAudioEnabled;
    
    audioTracks.forEach(track => {
      track.enabled = newEnabled;
    });
    
    setIsAudioEnabled(newEnabled);
    
    if (socket) {
      socket.emit('mediaStateChange', { video: isVideoEnabled, audio: newEnabled });
    }
  }, [isVideoEnabled, isAudioEnabled, socket]);

  // Select video device
  const selectVideoDevice = useCallback(async (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId);
    
    if (!isMediaActive || !localStreamRef.current) return;
    
    try {
      // Get new video track
      const newStream = await getMediaStream(deviceId, selectedAudioDeviceId);
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      if (!newVideoTrack) return;
      
      // Replace video track in local stream
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) {
        localStreamRef.current.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      localStreamRef.current.addTrack(newVideoTrack);
      
      // Update track in all peer connections
      for (const [, connection] of peersRef.current) {
        const sender = connection.peer._pc
          ?.getSenders()
          .find((s: RTCRtpSender) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }
      
      // Stop unused audio track from new stream
      newStream.getAudioTracks().forEach(t => t.stop());
      
      setLocalStream(localStreamRef.current);
    } catch (err) {
      console.error('Failed to switch video device:', err);
    }
  }, [isMediaActive, getMediaStream, selectedAudioDeviceId]);

  // Select audio device
  const selectAudioDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    
    if (!isMediaActive || !localStreamRef.current) return;
    
    try {
      // Get new audio track
      const newStream = await getMediaStream(selectedVideoDeviceId, deviceId);
      const newAudioTrack = newStream.getAudioTracks()[0];
      
      if (!newAudioTrack) return;
      
      // Replace audio track in local stream
      const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
      if (oldAudioTrack) {
        localStreamRef.current.removeTrack(oldAudioTrack);
        oldAudioTrack.stop();
      }
      localStreamRef.current.addTrack(newAudioTrack);
      
      // Update track in all peer connections
      for (const [, connection] of peersRef.current) {
        const sender = connection.peer._pc
          ?.getSenders()
          .find((s: RTCRtpSender) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newAudioTrack);
        }
      }
      
      // Stop unused video track from new stream
      newStream.getVideoTracks().forEach(t => t.stop());
      
      setLocalStream(localStreamRef.current);
    } catch (err) {
      console.error('Failed to switch audio device:', err);
    }
  }, [isMediaActive, getMediaStream, selectedVideoDeviceId]);

  // Handle incoming WebRTC signals
  useEffect(() => {
    if (!socket || !playerId) return;

    const handlePeerSignal = (fromPlayerId: string, signalData: unknown) => {
      console.log(`Received signal from ${fromPlayerId}`);
      
      let connection = peersRef.current.get(fromPlayerId);
      
      if (!connection) {
        // Create a new peer as non-initiator
        if (!localStreamRef.current) {
          console.warn('Received signal but no local stream available');
          return;
        }
        connection = createPeerConnection(fromPlayerId, false, localStreamRef.current);
      }
      
      if (connection) {
        connection.peer.signal(signalData as Peer.SignalData);
      }
    };

    const handlePeerMediaState = (peerId: string, state: MediaState) => {
      setPeerMediaStates(prev => new Map(prev).set(peerId, state));
    };

    const handlePeerLeft = (peerId: string) => {
      console.log(`Peer left: ${peerId}`);
      const connection = peersRef.current.get(peerId);
      if (connection) {
        connection.peer.destroy();
        peersRef.current.delete(peerId);
      }
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
      setPeerMediaStates(prev => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    };

    socket.on('peerSignal', handlePeerSignal);
    socket.on('peerMediaState', handlePeerMediaState);
    socket.on('peerLeft', handlePeerLeft);

    return () => {
      socket.off('peerSignal', handlePeerSignal);
      socket.off('peerMediaState', handlePeerMediaState);
      socket.off('peerLeft', handlePeerLeft);
    };
  }, [socket, playerId, createPeerConnection]);

  // Connect to new players when they join
  useEffect(() => {
    if (!isMediaActive || !localStreamRef.current || !room || !playerId) return;
    
    const otherPlayers = room.players.filter(p => p.id !== playerId && p.isConnected);
    
    for (const player of otherPlayers) {
      if (!peersRef.current.has(player.id)) {
        // Only initiate if our ID is "greater"
        const shouldInitiate = playerId > player.id;
        createPeerConnection(player.id, shouldInitiate, localStreamRef.current);
      }
    }
  }, [room, playerId, isMediaActive, createPeerConnection]);

  // Cleanup on unmount or room leave
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      for (const [, connection] of peersRef.current) {
        connection.peer.destroy();
      }
      peersRef.current.clear();
    };
  }, []);

  // Stop media when leaving room
  useEffect(() => {
    if (!room && isMediaActive) {
      stopMedia();
    }
  }, [room, isMediaActive, stopMedia]);

  return (
    <MediaContext.Provider
      value={{
        localStream,
        isVideoEnabled,
        isAudioEnabled,
        isMediaActive,
        remoteStreams,
        peerMediaStates,
        videoDevices,
        audioInputDevices,
        selectedVideoDeviceId,
        selectedAudioDeviceId,
        startMedia,
        stopMedia,
        toggleVideo,
        toggleAudio,
        selectVideoDevice,
        selectAudioDevice,
        error,
        isInitializing,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}
