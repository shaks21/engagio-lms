import { useState, useCallback, useEffect, useRef } from 'react';

export interface LoudspeakerState {
  isSpeaker: boolean;
  isSupported: boolean;
  setSpeaker: (enabled: boolean) => void;
  forceSpeaker: () => void;
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
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

function hasSetSinkIdSupport(): boolean {
  if (typeof HTMLMediaElement === 'undefined') return false;
  return typeof (HTMLMediaElement.prototype as any).setSinkId === 'function';
}

/**
 * Hook for toggling between loudspeaker and earpiece audio output on mobile.
 *
 * Strategy (best-effort on each platform):
 * - iOS Safari 18.2+: `audioSession?.setCategory('playback', { allowBluetooth: true })`
 * - Android Chrome: `HTMLAudioElement.setSinkId('default')` = speaker,
 *                   `setSinkId('communications')` = earpiece.
 * - Applies setSinkId to ALL remote <audio> elements in the DOM so all participants route correctly.
 * - Fallback: Play/resume a silent Audio element to nudge WebAudio onto the speaker route.
 */
export function useLoudspeaker(): LoudspeakerState {
  const [isSpeaker, setIsSpeaker] = useState(() => isMobile());
  const [isSupported] = useState(() => true); // always "supported" with graceful fallbacks
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apply setSinkId to every <audio> element found in the DOM (remote tracks)
  const applySetSinkIdToAll = useCallback(async (toSpeaker: boolean) => {
    if (!hasSetSinkIdSupport()) {
      console.log('[Audio] setSinkId not supported in this browser');
      return false;
    }
    const sinkId = toSpeaker ? 'default' : 'communications';
    const audioElements = Array.from(document.querySelectorAll('audio'));
    let succeeded = 0;
    let failed = 0;

    for (const el of audioElements) {
      try {
        await (el as any).setSinkId(sinkId);
        succeeded++;
      } catch (err: any) {
        failed++;
        console.warn(`[Audio] setSinkId failed for element: ${err.message}`);
      }
    }

    if (succeeded > 0) {
      console.log(`[Audio] SinkID set successfully: ${succeeded} element(s) routed to ${sinkId}`);
    }
    if (failed > 0) {
      console.warn(`[Audio] SinkID failed for ${failed} element(s)`);
    }
    return succeeded > 0;
  }, []);

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
      if (!el.src) {
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
    applySetSinkIdToAll(enabled).catch((err) => {
      console.warn('[Audio] setSinkId batch failed:', err);
    });
  }, [applyIOSAudioSession, applySetSinkIdToAll, applySilentAudioFallback]);

  const forceSpeaker = useCallback(() => {
    setIsSpeaker(true);
    applySilentAudioFallback(true);
    applyIOSAudioSession(true);
    applySetSinkIdToAll(true).catch(() => {});
  }, [applyIOSAudioSession, applySetSinkIdToAll, applySilentAudioFallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return {
    isSpeaker,
    isSupported,
    setSpeaker,
    forceSpeaker,
  };
}
