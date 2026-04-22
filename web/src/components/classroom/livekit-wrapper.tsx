'use client';

/**
 * ClassroomWithLiveKit - Wrapper component for LiveKit SFU integration
 * 
 * This component is designed to wrap the classroom page with LiveKit context.
 * Currently, the classroom uses socket.io + WebRTC for peer-to-peer connections.
 * This wrapper provides LiveKit context when LiveKit SFU integration is enabled.
 * 
 * LiveKit integration requires:
 * 1. Backend: Generate access token via POST /api/livekit/token
 * 2. Backend: Create LiveKit room
 * 3. Frontend: Connect to LiveKit room with token
 * 
 * Until LiveKit is fully integrated, the classroom uses socket.io/WebRTC fallback.
 */
import { useLiveKit } from '@/lib/livekit-context';
import { LiveKitProvider } from '@/lib/livekit-context';
import { Room, RoomEvent } from 'livekit-client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface ClassroomWithLiveKitProps {
  children: React.ReactNode;
  sessionId: string;
  userId: string;
  userName: string;
  livekitUrl?: string;
}

// LiveKit access token endpoint (to be implemented on backend)
async function getLiveKitToken(livekitUrl: string, roomName: string, participantName: string): Promise<string> {
  const response = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, participantName }),
  });
  if (!response.ok) {
    throw new Error('Failed to get LiveKit token');
  }
  const data = await response.json();
  return data.token;
}

export function ClassroomWithLiveKit({ children, sessionId, userId, userName, livekitUrl }: ClassroomWithLiveKitProps) {
  // State for LiveKit room
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Only attempt LiveKit connection if URL is provided
  const connectToLiveKit = useCallback(async () => {
    if (!livekitUrl || !sessionId || !userId) {
      console.log('[LiveKit] No URL provided, using socket.io/WebRTC fallback');
      return;
    }
    
    try {
      console.log('[LiveKit] Connecting to:', livekitUrl);
      
      // Get token from backend (requires backend implementation)
      const token = await getLiveKitToken(livekitUrl, sessionId, userName || userId);
      
      // Create and connect room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      
      newRoom.on(RoomEvent.Connected, () => {
        console.log('[LiveKit] Connected to room');
        setIsConnected(true);
      });
      
      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('[LiveKit] Disconnected from room');
        setIsConnected(false);
      });
      
      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('[LiveKit] Participant connected:', participant.identity);
      });
      
      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('[LiveKit] Participant disconnected:', participant.identity);
      });
      
      await newRoom.connect(livekitUrl, token);
      setRoom(newRoom);
      
    } catch (err) {
      console.error('[LiveKit] Connection failed, using socket.io/WebRTC fallback:', err);
      setError(err instanceof Error ? err.message : 'LiveKit connection failed');
      setIsConnected(false);
    }
  }, [livekitUrl, sessionId, userId, userName]);
  
  const disconnectFromLiveKit = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
    }
  }, [room]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);
  
  // Don't wrap if not connected - let children use socket.io/WebRTC fallback
  if (!isConnected || !room) {
    return (
      <LiveKitProvider room={null} isConnected={false}>
        {children}
      </LiveKitProvider>
    );
  }
  
  return (
    <LiveKitProvider 
      room={room} 
      isConnected={isConnected}
      connect={connectToLiveKit}
      disconnect={disconnectFromLiveKit}
    >
      {children}
    </LiveKitProvider>
  );
}
