'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import { useEngagementTracker } from '@/hooks/useEngagementTracker';
import Toolbar from '@/components/classroom/Toolbar';
import ParticipantsPanel from '@/components/classroom/Participants';
import Chat from '@/components/classroom/Chat';
import Timer from '@/components/classroom/Timer';

interface SessionInfo {
  id: string;
  classroomCode: string;
  course?: { name: string; id: string };
  userId: string;
}

type Participant = {
  userId: string;
  clientId: string;
  name?: string;
  status: 'online' | 'away' | 'offline';
  joinedAt?: Date;
  isHost?: boolean;
};

export default function ClassroomPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const router = useRouter();
  const { user, tenantId, userId, userName } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [screenShareActive, setScreenShareActive] = useState(false);

  const { start: startTracking, stop: stopTracking } = useEngagementTracker(socket);

  useEffect(() => {
    if (!sessionId || !userId || !tenantId) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3000/classroom';
    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('joinClassroom', { tenantId, sessionId, courseId: '', userId });
    });

    newSocket.on('user-joined', (data: { userId: string; clientId: string }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.clientId === data.clientId)) return prev;
        return [...prev, { userId: data.userId, clientId: data.clientId, name: data.userId.slice(0, 6), status: 'online' }];
      });
    });

    newSocket.on('user-left', (data: { clientId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.clientId !== data.clientId));
    });

    if (newSocket.id) {
      setParticipants([{ userId, clientId: newSocket.id, name: userName || user?.email || 'You', status: 'online', isHost: true }]);
    }

    const timer = setTimeout(() => setLoading(false), 1000);
    return () => { clearTimeout(timer); newSocket.disconnect(); };
  }, [sessionId, userId, tenantId]);

  const handleLeave = useCallback(() => {
    socket?.emit('engagementEvent', { type: 'LEAVE', payload: { sessionId } });
    stopTracking();
    socket?.disconnect();
    router.push('/dashboard/classroom');
  }, [socket, sessionId, stopTracking, router]);

  const handleToggleMic = useCallback((active: boolean) => {
    setMicActive(active);
    socket?.emit('engagementEvent', { type: 'MIC', payload: { active } });
  }, [socket]);

  const handleToggleScreenShare = useCallback((active: boolean) => {
    setScreenShareActive(active);
    socket?.emit('engagementEvent', { type: 'SCREEN_SHARE', payload: { active } });
  }, [socket]);

  const handleSendMessage = useCallback((message: string) => {
    socket?.emit('engagementEvent', { type: 'CHAT', payload: { message } });
  }, [socket]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="text-center"><div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p>Joining classroom...</p></div></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h1 className="font-semibold text-lg">Classroom {sessionId?.slice(0, 8)}</h1>
        <Timer />
      </div>
      <Toolbar onToggleMic={handleToggleMic} onToggleScreenShare={handleToggleScreenShare} onLeave={handleLeave} micActive={micActive} screenShareActive={screenShareActive} />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center"><div className="text-6xl mb-4">🎓</div><p className="text-gray-400">Classroom Active</p></div>
        </div>
        <ParticipantsPanel participants={participants} currentUserId={userId || ''} />
        <Chat userId={userId || ''} userName={userName || ''} onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
