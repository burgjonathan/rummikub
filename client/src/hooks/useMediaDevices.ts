import { useState, useEffect, useCallback } from 'react';

export interface MediaDevices {
  videoDevices: MediaDeviceInfo[];
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDevices>({
    videoDevices: [],
    audioInputDevices: [],
    audioOutputDevices: [],
  });
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      
      setDevices({
        videoDevices: allDevices.filter(d => d.kind === 'videoinput'),
        audioInputDevices: allDevices.filter(d => d.kind === 'audioinput'),
        audioOutputDevices: allDevices.filter(d => d.kind === 'audiooutput'),
      });
      
      // Check if we have real device labels (indicates permission granted)
      const hasLabels = allDevices.some(d => d.label !== '');
      setHasPermission(hasLabels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enumerate devices');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      setError(null);
      // Request permission by getting a temporary stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      // Stop all tracks immediately - we just wanted permission
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      // Re-enumerate to get device labels
      await enumerateDevices();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission denied';
      setError(message);
      setHasPermission(false);
      return false;
    }
  }, [enumerateDevices]);

  // Initial enumeration
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  // Listen for device changes (plug/unplug)
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    ...devices,
    hasPermission,
    error,
    requestPermission,
    refreshDevices: enumerateDevices,
  };
}
