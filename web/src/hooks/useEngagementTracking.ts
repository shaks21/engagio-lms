import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

/**
 * useEngagementTracking — emits window blur/focus events via Socket.io
 * Weights: BLUR (-30 per 5s window), FOCUS (neutral)
 */
export function useEngagementTracking(socket: Socket | null, userId: string | null, sessionId: string | null) {
  const [isTracking, setIsTracking] = useState(false);
  const blurCountRef = useRef(0);
  const lastBlurEmitRef = useRef(0);

  const emitBlur = useCallback(() => {
    if (!socket || !sessionId || !userId) return;
    blurCountRef.current += 1;
    const now = Date.now();
    // Throttle: max once per 5s
    if (now - lastBlurEmitRef.current < 5000) return;
    lastBlurEmitRef.current = now;

    socket.emit('engagementEvent', {
      type: 'BLUR',
      payload: { blurCount: blurCountRef.current, userId, sessionId },
    });
  }, [socket, sessionId, userId]);

  const emitFocus = useCallback(() => {
    if (!socket || !sessionId || !userId) return;
    socket.emit('engagementEvent', {
      type: 'FOCUS',
      payload: { userId, sessionId },
    });
  }, [socket, sessionId, userId]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      emitBlur();
    } else {
      emitFocus();
    }
  }, [emitBlur, emitFocus]);

  useEffect(() => {
    if (!isTracking) return;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Also listen to window blur for cases where visibilitychange doesn't fire
    window.addEventListener('blur', emitBlur);
    window.addEventListener('focus', emitFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', emitBlur);
      window.removeEventListener('focus', emitFocus);
    };
  }, [isTracking, handleVisibilityChange, emitBlur, emitFocus]);

  return {
    isTracking,
    start: () => setIsTracking(true),
    stop: () => setIsTracking(false),
  };
}
