import { useEffect, useRef, type RefObject } from 'react';

/**
 * Boosts the volume of an HTMLAudioElement using Web Audio API GainNode.
 * This is specifically needed on mobile where default WebRTC audio can be quiet.
 *
 * @param audioRef - React ref to the audio element
 * @param options  - { enabled: boolean; gain?: number (default 1.8) }
 */
export function useAudioGainBoost(
  audioRef: RefObject<HTMLAudioElement | null>,
  options: { enabled: boolean; gain?: number } = { enabled: false },
) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const { enabled, gain = 1.8 } = options;

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !enabled || gain <= 1) {
      return;
    }

    // Web Audio may not be available in eg. jsdom or very old browsers
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
    } catch {
      console.warn('[useAudioGainBoost] AudioContext not supported');
      return;
    }

    try {
      const source = audioCtx.createMediaElementSource(audioEl);
      sourceRef.current = source;
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = gain;
      gainNodeRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
    } catch (err) {
      console.warn('[useAudioGainBoost] Failed to wire graph:', err);
      return;
    }

    return () => {
      try {
        sourceRef.current?.disconnect();
        gainNodeRef.current?.disconnect();
        audioCtxRef.current?.close().catch(() => {});
      } catch {
        /* ignore teardown errors */
      } finally {
        sourceRef.current = null;
        gainNodeRef.current = null;
        audioCtxRef.current = null;
      }
    };
  }, [audioRef, enabled, gain]);
}

/**
 * Resume the AudioContext on first user interaction.
 * Mobile browsers (especially Safari) require a gesture to start audio.
 */
export function useResumeAudioContext() {
  const resumedRef = useRef(false);

  useEffect(() => {
    if (resumedRef.current) return;

    const resume = () => {
      if (resumedRef.current) return;
      if (typeof window !== 'undefined' && (window as any).__livekitAudioContext) {
        const ctx = (window as any).__livekitAudioContext;
        if (ctx?.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
      resumedRef.current = true;
    };

    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((e) => document.addEventListener(e, resume, { once: true, passive: true }));

    return () => {
      events.forEach((e) => document.removeEventListener(e, resume));
    };
  }, []);
}
