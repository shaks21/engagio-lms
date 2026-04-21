'use client';

import { createContext, useContext } from 'react';
import { Room, Participant } from 'livekit-client';

export type { Room, Participant };

interface LiveKitContextType {
  room: Room | null;
}

const LiveKitContext = createContext<LiveKitContextType>({ room: null });

export function LiveKitProvider({ children, room }: { children: React.ReactNode; room: Room | null }) {
  return (
    <LiveKitContext.Provider value={{ room }}>
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

export function useParticipants() {
  const { room } = useLiveKit();
  if (!room) return [];
  
  // Access participants through any cast to reach internal map
  const roomAny = room as any;
  // Try multiple possible internal properties
  if (roomAny._participantMap) {
    return Array.from(roomAny._participantMap.values());
  }
  if (roomAny._participants) {
    return roomAny._participants;
  }
  if (roomAny.engine?.participantMap) {
    return Array.from(roomAny.engine.participantMap.values());
  }
  // Fallback: try active speakers plus local participant
  const participants = room.activeSpeakers;
  if (participants.length > 0) {
    return participants;
  }
  // Last resort
  return [room.localParticipant];
}
