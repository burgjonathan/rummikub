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
  
  // Queue for signals received before media is ready
  const pendingSignalsRef = useRef<Map<string, unknown[]>>(new Map());

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

  // Process any queued signals that arrived before media was ready
  const processQueuedSignals = useCallback((stream: MediaStream) => {
    if (pendingSignalsRef.current.size === 0) return;
    
    console.log(`Processing ${pendingSignalsRef.current.size} queued peer(s) signals`);
    
    for (const [fromPlayerId, signals] of pendingSignalsRef.current) {
      // Create peer as non-initiator since they sent us signals first
      let connection = peersRef.current.get(fromPlayerId);
      if (!connection) {
        console.log(`Creating peer connection for queued signals from ${fromPlayerId}`);
        const newConnection = createPeerConnection(fromPlayerId, false, stream);
        if (newConnection) {
          connection = newConnection;
        }
      }
      
      if (connection) {
        for (const signalData of signals) {
          try {
            connection.peer.signal(signalData as Peer.SignalData);
          } catch (err) {
            console.error(`Failed to process queued signal from ${fromPlayerId}:`, err);
          }
        }
      }
    }
    
    pendingSignalsRef.current.clear();
  }, [createPeerConnection]);

  // Connect to all players in the room
  const connectToRoom = useCallback((stream: MediaStream) => {
    if (!room || !playerId) return;
    
    // First, process any queued signals from peers who messaged us before we were ready
    processQueuedSignals(stream);
    
    // Get other players in the room
    const otherPlayers = room.players.filter(p => p.id !== playerId && p.isConnected);
    
    for (const player of otherPlayers) {
      // Skip if we already have a connection (might have been created from queued signals)
      if (peersRef.current.has(player.id)) {
        continue;
      }
      
      // Only initiate if our ID is "greater" (to avoid duplicate connections)
      const shouldInitiate = playerId > player.id;
      createPeerConnection(player.id, shouldInitiate, stream);
    }
  }, [room, playerId, createPeerConnection, processQueuedSignals]);

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
      
      // Broadcast our media state and that we're ready
      if (socket) {
        socket.emit('mediaStateChange', { video: true, audio: true });
        socket.emit('mediaReady');
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
      for (const [, connection] of peersRef.current) {        // Access internal RTCPeerConnection (simple-peer exposes this as _pc)
        const pc = (connection.peer as unknown as { _pc?: RTCPeerConnection })._pc;
        const sender = pc
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
        // Access internal RTCPeerConnection (simple-peer exposes this as _pc)
        const pc = (connection.peer as unknown as { _pc?: RTCPeerConnection })._pc;
        const sender = pc
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
      
      // If we don't have a local stream yet, queue the signal for later
      if (!localStreamRef.current) {
        console.log(`Queueing signal from ${fromPlayerId} (no local stream yet)`);
        const existing = pendingSignalsRef.current.get(fromPlayerId) || [];
        existing.push(signalData);
        pendingSignalsRef.current.set(fromPlayerId, existing);
        return;
      }
      
      let connection: PeerConnection | undefined = peersRef.current.get(fromPlayerId);
      
      if (!connection) {
        // Create a new peer as non-initiator (we received a signal, so they initiated)
        console.log(`Creating peer connection for ${fromPlayerId} as non-initiator`);
        const newConnection = createPeerConnection(fromPlayerId, false, localStreamRef.current);
        if (newConnection) {
          connection = newConnection;
        }
      }
      
      if (connection) {
        try {
          connection.peer.signal(signalData as Peer.SignalData);
        } catch (err) {
          console.error(`Failed to process signal from ${fromPlayerId}:`, err);
        }
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

    const handlePeerReady = (peerId: string) => {
      console.log(`Peer ${peerId} is ready for connections`);
      
      // If we have media active and don't have a connection to this peer, create one
      if (localStreamRef.current && playerId && !peersRef.current.has(peerId)) {
        // We initiate if our ID is greater, otherwise wait for their signals
        const shouldInitiate = playerId > peerId;
        console.log(`Creating connection to newly ready peer ${peerId}, initiator: ${shouldInitiate}`);
        createPeerConnection(peerId, shouldInitiate, localStreamRef.current);
      }
    };

    socket.on('peerSignal', handlePeerSignal);
    socket.on('peerMediaState', handlePeerMediaState);
    socket.on('peerLeft', handlePeerLeft);
    socket.on('peerReady', handlePeerReady);

    return () => {
      socket.off('peerSignal', handlePeerSignal);
      socket.off('peerMediaState', handlePeerMediaState);
      socket.off('peerLeft', handlePeerLeft);
      socket.off('peerReady', handlePeerReady);
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
