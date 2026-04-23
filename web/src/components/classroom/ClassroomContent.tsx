'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LiveKitRoom, useRoomContext } from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import '@livekit/components-styles';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '@/lib/auth-context';
import GlassHeader, { type ViewMode } from './GlassHeader';
import FocusLayout from './FocusLayout';
import Sidebar, { type SidebarTab } from './Sidebar';
import Toolbar from './Toolbar';
import ToastContainer, { type Toast } from './ToastContainer';
import PreJoin from './PreJoin';

/* ───────────────── types ───────────────── */

interface TokenPayload {
  token: string;
  livekitUrl: string;
  roomName: string;
}

/* ───────────────── sync hook (reads LiveKit state directly) ───────────────── */

function useSyncMediaState(room: Room) {
  // Re-read every 500ms for reliable sync (cheap — just property reads)
  const [, tick] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const lp = room.localParticipant;

  const micMuted = !lp.isMicrophoneEnabled;
  const cameraOff = !lp.isCameraEnabled;

  // Screen share: check for an active ScreenShare track publication
  const ssPub = lp.getTrackPublication(Track.Source.ScreenShare);
  const screenShareActive =
    !!ssPub && ssPub.isSubscribed && !ssPub.isMuted && !!ssPub.track;

  return { micMuted, cameraOff, screenShareActive };
}

interface ClassroomContentProps {
  sessionId: string;
}

/* ───────────────── socket hook ───────────────── */

function useClassroomSocket(
  sessionId: string,
  userId: string | null,
  tenantId: string
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!userId || !sessionId || !tenantId) return;

    const SOCKET =
      process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://engagio.duckdns.org/classroom';
    const sk = io(SOCKET, {
      transports: ['websocket'],
      autoConnect: true,
    });

    const onConnect = () => {
      setConnected(true);
      sk.emit('joinClassroom', {
        tenantId,
        sessionId,
        courseId: sessionId,
        userId,
        userName: userId,
        classroomCode: sessionId,
      });
    };

    const onDisconnect = () => setConnected(false);

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

/* ───────────────── Room UI (runs inside LiveKitRoom) ───────────────── */

function InnerRoomUI({
  sessionId,
  socket,
}: {
  sessionId: string;
  socket: Socket | null;
}) {
  const room = useRoomContext();
  const router = useRouter();
  const { user, userId, userName } = useAuth();

  // Sync media state from LiveKit (polls every 500ms — reliable + no event listener bugs)
  const { micMuted, cameraOff, screenShareActive } = useSyncMediaState(room);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [pinnedSid, setPinnedSid] = useState<string | undefined>(undefined);

  // Other state
  const [handRaised, setHandRaised] = useState(false);

  // Chat toast
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Media toggles — just call LiveKit, hook polls state automatically
  const handleToggleMic = useCallback(async () => {
    try {
      await room.localParticipant.setMicrophoneEnabled(micMuted);
      socket?.emit('engagementEvent', {
        type: 'MIC',
        payload: { active: micMuted },
      });
    } catch (e) {
      console.warn('[Room] Mic toggle failed', e);
    }
  }, [room, micMuted, socket]);

  const handleToggleCamera = useCallback(async () => {
    try {
      await room.localParticipant.setCameraEnabled(cameraOff);
      socket?.emit('engagementEvent', {
        type: 'CAMERA',
        payload: { active: cameraOff },
      });
    } catch (e) {
      console.warn('[Room] Camera toggle failed', e);
    }
  }, [room, cameraOff, socket]);

  const handleToggleScreenShare = useCallback(async () => {
    const willStart = !screenShareActive;
    try {
      await room.localParticipant.setScreenShareEnabled(willStart);
      addToast({
        id: Date.now().toString(),
        message: willStart ? 'Started screen sharing' : 'Stopped screen sharing',
        type: willStart ? 'success' : 'info',
      });
    } catch (e) {
      addToast({
        id: Date.now().toString(),
        message: 'Screen share not available',
        type: 'error',
      });
    }
  }, [room, screenShareActive, addToast]);

  const handleToggleHandRaise = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    addToast({
      id: Date.now().toString(),
      message: next ? 'Hand raised' : 'Hand lowered',
      type: 'info',
    });
  }, [handRaised, addToast]);

  const handleToggleChat = useCallback(() => {
    setSidebarTab('chat');
    setSidebarOpen((o) => !o);
    setUnreadChatCount(0);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((o) => !o);
  }, []);

  const handleLeave = useCallback(() => {
    room.disconnect();
    router.push('/dashboard');
  }, [room, router]);

  const handlePinParticipant = useCallback(
    (sid: string) => {
      setPinnedSid((prev) => (prev === sid ? undefined : sid));
    },
    []
  );

  const handleUnreadChange = useCallback((count: number) => {
    setUnreadChatCount(count);
  }, []);

  return (
    <>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Stage */}
        <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? 'mr-0' : ''
        }`}>
          <FocusLayout
            viewMode={viewMode}
            pinnedParticipantSid={pinnedSid}
            onPinParticipant={handlePinParticipant}
          />
        </main>

        {/* Sidebar */}
        <Sidebar
          open={sidebarOpen}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          onClose={() => setSidebarOpen(false)}
          sessionId={sessionId}
          socket={socket}
          userId={userId || ''}
          userName={userName || user?.email || 'Unknown'}
          unreadChatCount={unreadChatCount}
          onResetChatCount={() => setUnreadChatCount(0)}
          pinnedParticipantSid={pinnedSid}
          onPinParticipant={handlePinParticipant}
        />
      </div>

      {/* Floating Header */}
      <GlassHeader
        connected={room.state === 'connected'}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onLeave={handleLeave}
        participantCount={room.numParticipants}
      />

      {/* Floating Toolbar */}
      <Toolbar
        micMuted={micMuted}
        cameraOff={cameraOff}
        handRaised={handRaised}
        screenShareActive={screenShareActive}
        unreadChatCount={unreadChatCount}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleHandRaise={handleToggleHandRaise}
        onToggleChat={handleToggleChat}
        onToggleSidebar={handleToggleSidebar}
        onLeave={handleLeave}
        onToast={addToast}
        onPinLocal={() => handlePinParticipant(room.localParticipant.sid)}
        isLocalPinned={pinnedSid === room.localParticipant.sid}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

/* ───────────────── Main exported component ───────────────── */

export default function ClassroomContent({ sessionId }: ClassroomContentProps) {
  const { user, userId, userName, loading: authLoading } = useAuth();
  const tenantId = user?.tenantId || userId || '';

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // PreJoin: user's mic/camera preference before entering
  const [preJoinConfig, setPreJoinConfig] = useState<import('./PreJoin').PreJoinConfig | null>(null);

  const { socket } = useClassroomSocket(sessionId, userId, tenantId as string);

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
    return () => {
      cancelled = true;
    };
  }, [userId, sessionId, userName, user?.email]);

  /* ---- loading / error / unauth states ---- */
  if (authLoading || loading) {
    return (
      <div className="h-screen w-screen bg-edu-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-engagio-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">
            {authLoading ? 'Authenticating…' : 'Connecting to classroom…'}
          </p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="h-screen w-screen bg-edu-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-white text-xl mb-2">Authentication Required</h2>
          <p className="text-gray-400 mb-4">Please log in to join the classroom.</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-engagio-600 text-white rounded-lg hover:bg-engagio-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-edu-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-edu-danger text-4xl mb-4">⚠️</div>
          <h2 className="text-white text-xl mb-2">Failed to Join Classroom</h2>
          <p className="text-gray-400">{error}</p>
          <a
            href="/dashboard"
            className="mt-4 inline-block px-4 py-2 bg-engagio-600 text-white rounded-lg hover:bg-engagio-700 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="h-screen w-screen bg-edu-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎥</div>
          <p className="text-white text-xl mb-2">Preparing classroom…</p>
        </div>
      </div>
    );
  }

  /* ── Pre-join ── */
  if (!preJoinConfig) {
    return (
      <PreJoin
        roomName={sessionId}
        userName={userName || 'User'}
        onJoin={(config) => setPreJoinConfig(config)}
      />
    );
  }

  /* ── Live classroom ── */
  return (
    <div className="h-screen w-screen bg-edu-dark flex flex-col overflow-hidden">
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        video={preJoinConfig.cameraEnabled}
        audio={preJoinConfig.micEnabled}
        options={{ adaptiveStream: true, dynacast: true }}
        onConnected={onConnected}
        onDisconnected={onDisconnected}
        onError={onError}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <InnerRoomUI sessionId={sessionId} socket={socket} />
      </LiveKitRoom>
    </div>
  );
}
