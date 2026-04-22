'use client';

import React, { useCallback } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';

interface LiveKitRoomWrapperProps {
  children: React.ReactNode;
  token: string;
  serverUrl: string;
  roomName: string;
  userId: string;
  displayName: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export default function LiveKitRoomWrapper({
  children,
  token,
  serverUrl,
  roomName,
  userId,
  displayName,
  onConnected,
  onDisconnected,
  onError,
}: LiveKitRoomWrapperProps) {
  const handleConnected = useCallback(() => {
    console.log('[LiveKit] Connected to room:', roomName);
    onConnected?.();
  }, [roomName, onConnected]);

  const handleDisconnected = useCallback(() => {
    console.log('[LiveKit] Disconnected from room');
    onDisconnected?.();
  }, [onDisconnected]);

  const handleError = useCallback((error: Error) => {
    console.error('[LiveKit] Error:', error);
    onError?.(error);
  }, [onError]);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      video={true}
      audio={true}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      className="livekit-room"
    >
      {children}
    </LiveKitRoom>
  );
}
