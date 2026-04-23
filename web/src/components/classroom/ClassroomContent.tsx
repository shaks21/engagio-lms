'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '@/lib/auth-context';
import Toolbar from '@/components/classroom/Toolbar';
import Chat from '@/components/classroom/Chat';
import Timer from '@/components/classroom/Timer';

/* ───────────────── types ───────────────── */

interface TokenPayload {
  token: string;
  livekitUrl: string;
  roomName: string;
}

interface ClassroomContentProps {
  sessionId: string;
}

function useClassroomSocket(sessionId: string, userId: string | null, tenantId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId || !sessionId || !tenantId) return;

    const SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://engagio.duckdns.org';
    const sk = io(SOCKET, {
      transports: ['websocket'],
      autoConnect: true,
    });

    const onConnect = () => {
      setConnected(true);
      // Join the classroom room
      sk.emit('joinClassroom', {
        tenantId,
        sessionId,
        courseId: sessionId,
        userId,
        userName: userId,
        classroomCode: sessionId,
      });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    sk.on('connect', onConnect);
    sk.on('disconnect', onDisconnect);
    sk.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    setSocket(sk);

    return () => {
      sk.off('connect', onConnect);
      sk.off('disconnect', onDisconnect);
      sk.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [sessionId, userId, tenantId]);

  return { socket, connected };
}

/* ───────────────── child inside LiveKitRoom ───────────────── */

function RoomUI({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const room = useRoomContext();
  const router = useRouter();
  const { user, userId, userName } = useAuth();

  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [showChat, setShowChat] = useState(true);

  const handleToggleMic = useCallback(async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(!micActive);
      setMicActive(!micActive);
      socket?.emit('engagementEvent', { type: 'MIC', payload: { active: !micActive } });
    } catch { /* no-op */ }
  }, [room, micActive, socket]);

  const handleToggleCamera = useCallback(async () => {
    try {
      await room.localParticipant.setCameraEnabled(!cameraActive);
      setCameraActive(!cameraActive);
      socket?.emit('engagementEvent', { type: 'CAMERA', payload: { active: !cameraActive } });
    } catch { /* no-op */ }
  }, [room, cameraActive, socket]);

  const handleLeave = useCallback(() => {
    room.disconnect();
    router.push('/dashboard');
  }, [room, router]);

  return (
    <>
      <div className="flex-1 flex overflow-hidden">
        {/* Video */}
        <div className="flex-1 overflow-auto">
          <VideoConference />
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 border-l border-gray-700 bg-gray-800/50 flex flex-col">
            <div className="p-2 border-b border-gray-700 text-gray-300 text-sm font-medium flex items-center justify-between">
              <span>Chat</span>
              <button
                onClick={() => setShowChat(false)}
                className="text-gray-500 hover:text-gray-300 text-xs"
                title="Hide Chat"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Chat
                userId={userId || ''}
                userName={userName || user?.email || 'Unknown'}
                socket={socket}
                sessionId={sessionId}
                embedded
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-900 border-t border-gray-800 px-4 py-2">
        <Toolbar
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onLeave={handleLeave}
          micActive={micActive}
          cameraActive={cameraActive}
          screenShareActive={false}
          onToggleScreenShare={() => alert('Screen share coming soon')}
          onToggleChat={() => setShowChat((v) => !v)}
          unreadMessages={0}
        />
      </div>
    </>
  );
}

/* ───────────────── main component ───────────────── */

export default function ClassroomContent({ sessionId }: ClassroomContentProps) {
  const router = useRouter();
  const { user, userId, userName, loading: authLoading } = useAuth();
  const tenantId = user?.tenantId || userId || '';

  /* 1️⃣  ALL hooks must run unconditionally before any early-return */
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const onConnected = useCallback(() => {
    console.log('[LiveKit] Connected');
    setConnected(true);
  }, []);

  const onDisconnected = useCallback(() => {
    console.log('[LiveKit] Disconnected');
    setConnected(false);
  }, []);

  const onError = useCallback((err: Error) => {
    console.error('[LiveKit] Error:', err);
    setError(err.message);
  }, []);

  const { socket } = useClassroomSocket(sessionId, userId, tenantId as string);

  /* ---- token fetch ---- */
  useEffect(() => {
    if (!userId || !sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const API = process.env.NEXT_PUBLIC_API_URL || '';
        const url =
          `${API}/classroom/token/${encodeURIComponent(sessionId)}` +
          `?userId=${encodeURIComponent(userId)}` +
          `&displayName=${encodeURIComponent(userName || user?.email || 'Unknown')}` +
          `&role=teacher`;

        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `HTTP ${res.status}`);
        }
        const data: TokenPayload = await res.json();
        setToken(data.token);
        setServerUrl(data.livekitUrl);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || 'Failed to get classroom token');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchToken();
    return () => { cancelled = true; };
  }, [userId, sessionId, userName, user?.email]);

  /* 2️⃣  Early returns — AFTER all hooks have already run */
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400">{authLoading ? 'Authenticating…' : 'Connecting to classroom…'}</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-white text-xl mb-2">Authentication Required</h2>
          <p className="text-gray-400 mb-4">Please log in to join the classroom.</p>
          <a href="/login" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-white text-xl mb-2">Failed to Join Classroom</h2>
          <p className="text-gray-400">{error}</p>
          <a href="/dashboard" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎥</div>
          <p className="text-white text-xl mb-2">Waiting for LiveKit connection…</p>
        </div>
      </div>
    );
  }

  /* 🎥 Render the actual classroom */
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-white text-lg font-semibold">Virtual Classroom</h1>
          <span className="text-sm">
            {connected ? (
              <span className="text-green-500">● Live</span>
            ) : (
              <span className="text-yellow-500">● Connecting…</span>
            )}
          </span>
          <Timer startTime={new Date(Date.now())} />
        </div>
        <div className="text-xs text-gray-500 font-mono">{sessionId.slice(0, 8)}…</div>
      </div>

      {error && (
        <div className="bg-red-600/20 border-b border-red-600 px-4 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}

      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        video={true}
        audio={true}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <RoomUI sessionId={sessionId} socket={socket} />
      </LiveKitRoom>
    </div>
  );
}
