import { useState, useCallback, useEffect, useRef } from 'react';

export interface LoudspeakerState {
  isSpeaker: boolean;
  isSupported: boolean;
  setSpeaker: (enabled: boolean) => void;
  forceSpeaker: () => void;
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (((navigator as any).platform === 'MacIntel') && ((navigator as any).maxTouchPoints ?? 0) > 1);
}

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

/**
 * Hook for toggling between loudspeaker and earpiece audio output on mobile.
 *
 * Strategy (best-effort on each platform):
 * - iOS Safari 18.2+: `audioSession?.setCategory('playback', { allowBluetooth: true })`
 *   then route to speaker.
 * - Android Chrome: `HTMLAudioElement.setSinkId('default')`  = speaker,
 *                   `setSinkId('communications')`  = earpiece.
 * - Fallback: Play/resume a silent Audio element with `playsInline; webkit-playsinline`
 *   to nudge WebAudio onto the speaker route.
 */
export function useLoudspeaker(): LoudspeakerState {
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isSupported] = useState(true); // always supported; graceful on each platform
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  // Try iOS audioSession API
  const applyIOSAudioSession = useCallback((toSpeaker: boolean) => {
    if (!isIOS()) return false;
    const audioSession = (navigator as any).audioSession;
    if (!audioSession?.setCategory) return false;
    try {
      audioSession.setCategory(toSpeaker ? 'playback' : 'playback', { allowBluetooth: true });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Try Android setSinkId
  const applySetSinkId = useCallback(async (toSpeaker: boolean) => {
    const audioEl = audioRef.current;
    if (!audioEl || !(audioEl as any).sinkId) return false;
    try {
      // On Android, deviceId: 'default' is loudspeaker; 'communications' is earpiece
      const sinkId = toSpeaker ? 'default' : 'communications';
      await (audioEl as any).setSinkId(sinkId);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Fallback: silent audio keeps WebAudio context playing on speaker route
  const applySilentAudioFallback = useCallback((toSpeaker: boolean) => {
    let el = audioRef.current;
    if (!el) {
      el = document.createElement('audio');
      el.setAttribute('playsInline', '');
      el.setAttribute('webkit-playsinline', '');
      el.muted = false;
      el.crossOrigin = 'anonymous';
      el.volume = 0.001;
      audioRef.current = el;
    }

    if (toSpeaker) {
      // Keep a silent audio playing so the OS keeps output on the speaker route
      if (!el.src) {
        // use a 1-second silent audio data uri
        el.src = 'data:audio/wav;base64,UklGRiIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        el.loop = true;
      }
      if (typeof el.play === 'function') {
        const p = el.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      }
    } else {
      el.pause();
    }
  }, []);

  const setSpeaker = useCallback((enabled: boolean) => {
    setIsSpeaker(enabled);
    applySilentAudioFallback(enabled);
    applyIOSAudioSession(enabled);
    applySetSinkId(enabled).catch(() => {});
  }, [applyIOSAudioSession, applySetSinkId, applySilentAudioFallback]);

  // Expose imperative force for toolbar instant-toggle
  const forceSpeaker = useCallback(() => {
    setIsSpeaker(true);
    applySilentAudioFallback(true);
    applyIOSAudioSession(true);
    applySetSinkId(true).catch(() => {});
  }, [applyIOSAudioSession, applySetSinkId, applySilentAudioFallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return {
    isSpeaker,
    isSupported,
    setSpeaker,
    forceSpeaker,
  };
}
