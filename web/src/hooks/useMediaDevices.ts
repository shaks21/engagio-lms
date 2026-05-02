import { useState, useEffect, useCallback, useRef } from 'react';

export type FacingMode = 'user' | 'environment';
export type AudioOutputType = 'default' | 'speaker' | 'headset';

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface MediaDeviceState {
  videoDevices: MediaDeviceInfo[];
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  selectedCameraId: string | null;
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  facingMode: FacingMode;
  audioOutputType: AudioOutputType;
  hasPermission: boolean;
  loading: boolean;
}

const STORAGE_KEY = 'engagio-media-devices';

function loadSaved(): Partial<MediaDeviceState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: Partial<MediaDeviceState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/**
 * Hook to enumerate and manage media devices (cameras, mics, audio outputs).
 * Handles mobile-facing rear/front camera switching and audio output routing.
 */
export function useMediaDevices() {
  const saved = loadSaved();
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>(() => saved?.videoDevices ?? []);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>(() => saved?.audioInputDevices ?? []);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>(() => saved?.audioOutputDevices ?? []);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(() => saved?.selectedCameraId ?? null);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string | null>(() => saved?.selectedAudioInputId ?? null);
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string | null>(() => saved?.selectedAudioOutputId ?? null);
  const [facingMode, setFacingMode] = useState<FacingMode>(() => saved?.facingMode ?? 'user');
  const [audioOutputType, setAudioOutputType] = useState<AudioOutputType>(() => saved?.audioOutputType ?? 'default');
  const [hasPermission, setHasPermission] = useState<boolean>(() => saved?.hasPermission ?? false);
  const [loading, setLoading] = useState(false);

  const enumerateRef = useRef(false);

  const enumerate = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    if (enumerateRef.current) return;
    enumerateRef.current = true;
    setLoading(true);

    try {
      // Request permission first so labels are populated
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setHasPermission(true);
    } catch {
      // permission denied or no devices — still try enumerating with empty labels
      setHasPermission(false);
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}`, kind: d.kind as MediaDeviceKind }));
      const audios = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 4)}`, kind: d.kind as MediaDeviceKind }));
      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Output ${d.deviceId.slice(0, 4)}`, kind: d.kind as MediaDeviceKind }));

      setVideoDevices(videos);
      setAudioInputDevices(audios);
      setAudioOutputDevices(outputs);

      // Auto-select sensible defaults
      if (!selectedCameraId && videos.length > 0) {
        // Prefer front (user) camera on mobile
        const frontCam = videos.find((d) => /front|user|face/i.test(d.label));
        setSelectedCameraId(frontCam?.deviceId ?? videos[0].deviceId);
      }
      if (!selectedAudioInputId && audios.length > 0) {
        setSelectedAudioInputId(audios[0].deviceId);
      }
      if (!selectedAudioOutputId && outputs.length > 0) {
        const speaker = outputs.find((d) => /speaker|default/i.test(d.label));
        setSelectedAudioOutputId(speaker?.deviceId ?? outputs[0].deviceId);
      }
    } catch (e) {
      console.warn('[useMediaDevices] Enumeration failed:', e);
    } finally {
      setLoading(false);
      enumerateRef.current = false;
    }
  }, [selectedCameraId, selectedAudioInputId, selectedAudioOutputId]);

  // Persist preferences
  useEffect(() => {
    saveState({
      selectedCameraId,
      selectedAudioInputId,
      selectedAudioOutputId,
      facingMode,
      audioOutputType,
      hasPermission,
    });
  }, [selectedCameraId, selectedAudioInputId, selectedAudioOutputId, facingMode, audioOutputType, hasPermission]);

  // Build video constraints from selected camera + facing mode
  const getVideoConstraints = useCallback((): MediaTrackConstraints => {
    const base: MediaTrackConstraints = {
      facingMode: { exact: facingMode },
    };
    if (selectedCameraId) {
      base.deviceId = { exact: selectedCameraId };
    }
    return base;
  }, [facingMode, selectedCameraId]);

  // Build audio constraints with mobile-friendly processing
  const getAudioConstraints = useCallback((): MediaTrackConstraints => {
    const base: MediaTrackConstraints = {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 2 },
    };
    if (selectedAudioInputId) {
      base.deviceId = { exact: selectedAudioInputId };
    }
    return base;
  }, [selectedAudioInputId]);

  // Apply audio output (setSinkId) to an audio element if supported
  const applyAudioOutput = useCallback(async (audioEl: HTMLAudioElement | null) => {
    if (!audioEl || !selectedAudioOutputId) return false;
    if (typeof (audioEl as any).setSinkId !== 'function') return false;
    try {
      await (audioEl as any).setSinkId(selectedAudioOutputId);
      return true;
    } catch (e) {
      console.warn('[useMediaDevices] setSinkId failed:', e);
      return false;
    }
  }, [selectedAudioOutputId]);

  // Guess output type from label
  const guessOutputType = useCallback((label: string): AudioOutputType => {
    const lower = label.toLowerCase();
    if (/headphone|headset|earphone|earbud|airpod|bluetooth/i.test(lower)) return 'headset';
    if (/speaker|built-in|default/i.test(lower)) return 'speaker';
    return 'default';
  }, []);

  return {
    videoDevices,
    audioInputDevices,
    audioOutputDevices,
    selectedCameraId,
    selectedAudioInputId,
    selectedAudioOutputId,
    facingMode,
    audioOutputType,
    hasPermission,
    loading,
    enumerate,
    setSelectedCameraId,
    setSelectedAudioInputId,
    setSelectedAudioOutputId,
    setFacingMode,
    setAudioOutputType,
    getVideoConstraints,
    getAudioConstraints,
    applyAudioOutput,
    guessOutputType,
  };
}
