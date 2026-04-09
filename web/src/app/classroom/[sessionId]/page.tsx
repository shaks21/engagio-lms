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

type MediaState = {
  micActive: boolean;
  cameraActive: boolean;
  screenShareActive: boolean;
};

type Participant = {
  userId: string;
  clientId: string;
  name?: string;
  status: 'online' | 'away' | 'offline';
  joinedAt?: Date;
  isHost?: boolean;
  media: MediaState;
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
  const [cameraActive, setCameraActive] = useState(false);
  const [screenShareActive, setScreenShareActive] = useState(false);

  const { start: startTracking, stop: stopTracking } = useEngagementTracker(socket);

  // Initialize socket connection
  useEffect(() => {
    if (!sessionId || !userId || !tenantId) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')
      ? `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')}/classroom`
      : 'ws://164.68.119.230:3000/classroom';

    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      newSocket.emit('joinClassroom', { tenantId, sessionId, courseId: '', userId, classroomCode: sessionId });
    });

    newSocket.on('user-joined', (data: { userId: string; clientId: string }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.clientId === data.clientId)) return prev;
        return [...prev, {
          userId: data.userId,
          clientId: data.clientId,
          name: data.userId.slice(0, 8),
          status: 'online',
          media: { micActive: false, cameraActive: false, screenShareActive: false },
        }];
      });
    });

    newSocket.on('user-left', (data: { clientId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.clientId !== data.clientId));
    });

    // Listen for media updates from other participants
    newSocket.on('participant-media-update', (data: {
      userId: string;
      clientId: string;
      micActive?: boolean;
      cameraActive?: boolean;
      screenShareActive?: boolean;
    }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.clientId === data.clientId || p.userId === data.userId
            ? {
                ...p,
                media: {
                  ...p.media,
                  ...(data.micActive !== undefined ? { micActive: data.micActive } : {}),
                  ...(data.cameraActive !== undefined ? { cameraActive: data.cameraActive } : {}),
                  ...(data.screenShareActive !== undefined ? { screenShareActive: data.screenShareActive } : {}),
                },
              }
            : p
        )
      );
    });

    // Initialize self as participant with default media state
    const self: Participant = {
      userId,
      clientId: '',
      name: userName || user?.email || 'You',
      status: 'online',
      isHost: true,
      media: { micActive: true, cameraActive: false, screenShareActive: false },
    };

    newSocket.on('connect', () => {
      self.clientId = newSocket.id || '';
      setParticipants([{ ...self, clientId: newSocket.id || '' }]);
    });

    const timer = setTimeout(() => setLoading(false), 1000);
    return () => { clearTimeout(timer); newSocket.disconnect(); };
  }, [sessionId, userId, tenantId, userName, user]);

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

  const handleToggleCamera = useCallback((active: boolean) => {
    setCameraActive(active);
    socket?.emit('engagementEvent', { type: 'CAMERA', payload: { active } });
  }, [socket]);

  const handleToggleScreenShare = useCallback((active: boolean) => {
    setScreenShareActive(active);
    socket?.emit('engagementEvent', { type: 'SCREEN_SHARE', payload: { active } });
  }, [socket]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Joining classroom...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg">Classroom {sessionId?.slice(0, 8)}</h1>
          <div className="flex items-center gap-2">
            {/* Mic indicator */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${micActive ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {micActive ? (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
              {micActive ? 'Mic On' : 'Mic Off'}
            </div>
            {/* Camera indicator */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cameraActive ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {cameraActive ? (
                  <>
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                ) : (
                  <>
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
              {cameraActive ? 'Cam On' : 'Cam Off'}
            </div>
            {/* Screen share indicator */}
            {screenShareActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/30 text-blue-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>
                Sharing
              </div>
            )}
          </div>
        </div>
        <Timer />
      </div>

      {/* Toolbar with camera support */}
      <Toolbar
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onLeave={handleLeave}
        micActive={micActive}
        cameraActive={cameraActive}
        screenShareActive={screenShareActive}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid / main area */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-gray-900 relative overflow-auto">
          {/* My camera preview */}
          {cameraActive && (
            <div className="absolute bottom-4 left-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 z-10">
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                📹 Camera Preview
              </div>
            </div>
          )}
          {/* Participant video grid */}
          <div className="w-full max-w-[900px] p-6 mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {participants.map((p) => (
                <div key={p.clientId} className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mx-auto mb-2 text-2xl">
                      {p.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <p className="text-sm font-medium">{p.name || 'User'}</p>
                  </div>
                  {/* Media indicators on participant card */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {p.media.micActive ? (
                      <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">🎤</span>
                    ) : (
                      <span className="bg-red-500/80 px-1.5 py-0.5 rounded text-[10px]">🔇</span>
                    )}
                    {p.media.cameraActive && (
                      <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">📹</span>
                    )}
                    {p.media.screenShareActive && (
                      <span className="bg-blue-500/80 px-1.5 py-0.5 rounded text-[10px]">🖥️</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar with participants */}
        <div className="w-72 h-full border-l border-gray-700 overflow-hidden">
          <ParticipantsPanel
            participants={participants.map((p) => ({
              ...p,
              media: p.media,
            }))}
            currentUserId={userId || ''}
            showMediaStatus={true}
          />
        </div>
      </div>

      {/* Chat overlay */}
      {socket && (
        <Chat
          userId={userId || ''}
          userName={userName || ''}
          socket={socket}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
