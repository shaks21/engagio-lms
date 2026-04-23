'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LiveKitRoom,
  VideoConference,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';

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

/* ───────────────── helpers ───────────────── */

function useIsMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

/* ───────────────── child inside LiveKitRoom ───────────────── */

/**
 * Everything that must use LiveKit hooks (useRoom, useParticipants, …)
 * lives as a *child* of <LiveKitRoom>. That guarantees the context is
 * available and avoids any SSR issues because this component is only
 * ever rendered on the client (page.tsx loads via next/dynamic ssr:false).
 */
function RoomUI({ sessionId }: { sessionId: string }) {
  const room = useRoomContext();
  const router = useRouter();
  const { user, userId, userName } = useAuth();

  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);

  const handleToggleMic = useCallback(async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(!micActive);
      setMicActive(!micActive);
    } catch { /* no-op */ }
  }, [room, micActive]);

  const handleToggleCamera = useCallback(async () => {
    try {
      await room.localParticipant.setCameraEnabled(!cameraActive);
      setCameraActive(!cameraActive);
    } catch { /* no-op */ }
  }, [room, cameraActive]);

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
        <div className="w-80 border-l border-gray-700 bg-gray-800/50">
          <Chat
            userId={userId || ''}
            userName={userName || user?.email || 'Unknown'}
            socket={null}
            sessionId={sessionId}
          />
        </div>
      </div>

      <Toolbar
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onLeave={handleLeave}
        micActive={micActive}
        cameraActive={cameraActive}
        screenShareActive={false}
        onToggleScreenShare={() => alert('Screen share coming soon')}
      />
    </>
  );
}

/* ───────────────── main component ───────────────── */

export default function ClassroomContent({ sessionId }: ClassroomContentProps) {
  const { user, userId, userName } = useAuth();
  const mounted = useIsMounted();

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- auth gate ---- */
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400">Authenticating…</p>
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

  /* ---- fetch token ---- */
  useEffect(() => {
    if (!userId || !sessionId) return;
    let cancelled = false;

    const fetchToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `http://164.68.119.230:3000/api/classroom/token/${encodeURIComponent(sessionId)}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
        );
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
  }, [userId, sessionId]);

  /* ---- LiveKit callbacks ---- */
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

  /* ---- render states ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400">Connecting to classroom…</p>
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
        </div>
        <Timer startTime={new Date(Date.now())} />
      </div>

      {error && (
        <div className="bg-red-600/20 border-b border-red-600 px-4 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}

      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        video
        audio
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <RoomUI sessionId={sessionId} />
      </LiveKitRoom>
    </div>
  );
}
