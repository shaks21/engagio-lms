'use client';

import { useEffect } from 'react';

/**
 * Capture window blur/focus events and send BLUR/FOCUS engagement events
 * through the provided socket. This is the "secret sauce" for engagement
 * score tracking.
 *
 * @param socket    Socket.io instance (or any emitter with .emit())
 * @param sessionId Active classroom session ID
 * @param enabled   Whether to track (default true)
 */
export function useBlurDetection(
  socket: any,
  sessionId: string,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || !socket || !sessionId) return;

    const onBlur = () => {
      socket.emit('engagementEvent', {
        type: 'BLUR',
        payload: { sessionId, active: false },
      });
    };

    const onFocus = () => {
      socket.emit('engagementEvent', {
        type: 'FOCUS',
        payload: { sessionId, active: true },
      });
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [socket, sessionId, enabled]);
}
