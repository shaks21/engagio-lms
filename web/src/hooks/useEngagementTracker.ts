'use client';

import io, { Socket } from 'socket.io-client';
import { useEffect, useRef, useState, useCallback } from 'react';

export type EngagementEvent =
  | { type: 'FOCUS'; payload: { status: 'blur' | 'focus' } }
  | { type: 'MOUSE_TRACK'; payload: { x: number; y: number } }
  | { type: 'KEYSTROKE'; payload: { count: number } }
  | { type: 'CHAT'; payload: { message: string } }
  | { type: string; payload: Record<string, unknown> };

export function useEngagementTracker(socket: Socket | null) {
  const [active, setActive] = useState(false);
  const keystrokeCount = useRef(0);
  const activeRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  // Update socket ref when it changes
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const emitEvent = useCallback((event: EngagementEvent) => {
    if (activeRef.current && socketRef.current) {
      socketRef.current.emit('engagementEvent', event);
    }
  }, []);

  const emitMouseThrottled = useCallback(
    (() => {
      let lastEmit = 0;
      return (x: number, y: number) => {
        const now = Date.now();
        if (now - lastEmit >= 10000 && activeRef.current) {
          emitEvent({ type: 'MOUSE_TRACK', payload: { x, y } });
          lastEmit = now;
        }
      };
    })(),
    [emitEvent]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      emitMouseThrottled(e.clientX, e.clientY);
    },
    [emitMouseThrottled]
  );

  const handleKeyDown = useCallback(() => {
    keystrokeCount.current += 1;
  }, []);

  // Tab visibility change
  const handleVisibilityChange = useCallback(() => {
    const status = document.hidden ? 'blur' : 'focus';
    emitEvent({ type: 'FOCUS', payload: { status } });
  }, [emitEvent]);

  // Focus blur - emit every 5s when blurred
  useEffect(() => {
    if (!active) return;

    const handleFocusBlur = () => {
      if (document.hasFocus()) {
        emitEvent({ type: 'FOCUS', payload: { status: 'focus' } });
      }
    };

    window.addEventListener('focus', handleFocusBlur);
    window.addEventListener('blur', handleFocusBlur);

    // Every 5s, check blur state and emit
    const blurInterval = setInterval(() => {
      if (!document.hasFocus() && activeRef.current) {
        emitEvent({ type: 'FOCUS', payload: { status: 'blur' } });
      }
    }, 5000);

    return () => {
      window.removeEventListener('focus', handleFocusBlur);
      window.removeEventListener('blur', handleFocusBlur);
      clearInterval(blurInterval);
    };
  }, [active, emitEvent]);

  // Keystroke aggregation - emit every 30s
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      if (keystrokeCount.current > 0 && activeRef.current) {
        emitEvent({
          type: 'KEYSTROKE',
          payload: { count: keystrokeCount.current },
        });
        keystrokeCount.current = 0;
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [active, emitEvent]);

  const start = useCallback(() => {
    activeRef.current = true;
    setActive(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }, [handleMouseMove, handleKeyDown, handleVisibilityChange]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Flush remaining keystrokes
    if (keystrokeCount.current > 0 && socketRef.current) {
      socketRef.current.emit('engagementEvent', {
        type: 'KEYSTROKE',
        payload: { count: keystrokeCount.current },
      });
      keystrokeCount.current = 0;
    }
  }, [handleMouseMove, handleKeyDown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleMouseMove, handleKeyDown, handleVisibilityChange]);

  return { start, stop, active };
}
