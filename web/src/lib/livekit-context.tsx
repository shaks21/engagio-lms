'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Room, Participant, RoomEvent, ConnectionState } from 'livekit-client';

export type { Room, Participant };

interface LiveKitContextType {
  room: Room | null;
  isConnected: boolean;
  connect: (url: string, token: string, userId: string) => Promise<void>;
  disconnect: () => void;
}

const LiveKitContext = createContext<LiveKitContextType>({ 
  room: null, 
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
});

export function LiveKitProvider({ children, room, isConnected, connect, disconnect }: { 
  children: React.ReactNode; 
  room: Room | null;
  isConnected?: boolean;
  connect?: (url: string, token: string, userId: string) => Promise<void>;
  disconnect?: () => void;
}) {
  const [connected, setConnected] = useState(isConnected || false);
  
  return (
    <LiveKitContext.Provider value={{ 
      room, 
      isConnected: connected,
      connect: connect || (async () => {}),
      disconnect: disconnect || (() => {}),
    }}>
      {children}
    </LiveKitContext.Provider>
  );
}

export function useLiveKit() {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKit must be used within LiveKitProvider');
  }
  return context;
}

// useParticipants - Returns participants from the LiveKit room if connected
// Falls back to empty array if no LiveKit room is available (for socket/WebRTC fallback mode)
export function useParticipants(): Participant[] {
  const { room, isConnected } = useLiveKit();
  
  // If no room or not connected, return empty array
  // The classroom will use socket-based participants instead
  if (!room || !isConnected) {
    return [];
  }
  
  try {
    // Access participants through room's events or internal state
    const roomAny = room as any;
    
    // Try _participantMap (LiveKit internal)
    if (roomAny._participantMap && typeof roomAny._participantMap.values === 'function') {
      return Array.from(roomAny._participantMap.values()) as Participant[];
    }
    
    // Try _participants array
    if (Array.isArray(roomAny._participants)) {
      return roomAny._participants as Participant[];
    }
    
    // Try engine.participantMap
    if (roomAny.engine?.participantMap && typeof roomAny.engine.participantMap.values === 'function') {
      return Array.from(roomAny.engine.participantMap.values()) as Participant[];
    }
    
    // Fallback to activeSpeakers if available
    if (room.activeSpeakers && room.activeSpeakers.length > 0) {
      return room.activeSpeakers as Participant[];
    }
    
    // Last resort: return local participant
    if (room.localParticipant) {
      return [room.localParticipant];
    }
    
    return [];
  } catch (e) {
    console.warn('useParticipants error:', e);
    return [];
  }
}
