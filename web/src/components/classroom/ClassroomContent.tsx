'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { Message as ChatMessageType } from './Chat';
import PreJoin from './PreJoin';
import type { PollData } from './Poll';
import PollToast from './PollToast';
import QuizOverlay from './QuizOverlay';
import { useQuizSocket } from '@/hooks/useQuizSocket';
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

    const baseUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || 'wss://engagio.duckdns.org').replace(/\/$/, '');
    const sk = io(`${baseUrl}/classroom`, {
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

/** Breakout selective subscription hook with AUDIO-ONLY broadcast support.
 *  Student: subscribes only to participants in same breakout room (or unassigned).
 *  Teacher: subscribes to all but at LOW video quality.
 *  BREAKCAST OVERRIDE: When isBroadcasting=true, ALL students subscribe to
 *  teacher's AUDIO track, but video stays in room isolation.
 */
function useBreakoutSubscription(
  room: Room,
  isTeacher: boolean,
  userId: string,
  socket: Socket | null,
  sessionId: string,
) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState<string | null>(null);

  // Listen for broadcast state changes from backend
  useEffect(() => {
    if (!socket) return;
    const onBroadcastChange = (data: { isBroadcasting: boolean }) => {
      setIsBroadcasting(data.isBroadcasting);
    };
    socket.on('broadcast-state-changed', onBroadcastChange);
    return () => { socket.off('broadcast-state-changed', onBroadcastChange); };
  }, [socket]);

  // Listen for teacher monitor state changes (students monitor teacher state)
  useEffect(() => {
    if (!socket) return;
    const onTeacherMonitor = (payload: any) => {
      const monitoring = payload.action === 'START_MONITOR';
      const target = payload.roomId || null;
      setIsMonitoring(monitoring);
      setMonitorTarget(target);
      const state = {
        isMonitoring: monitoring,
        monitorTarget: target,
        peekMode: payload.peekMode !== false,
        notify: payload.notify !== false,
        action: payload.action,
      };
      (window as any).__breakoutState = {
        ...((window as any).__breakoutState || {}),
        isMonitoring: state.isMonitoring,
        monitorTarget: state.monitorTarget,
        peekMode: state.peekMode,
      };
    };
    socket.on('teacher-monitor-state', onTeacherMonitor);
    return () => { socket.off('teacher-monitor-state', onTeacherMonitor); };
  }, [socket]);

  // Fetch breakout assignments from API
  useEffect(() => {
    if (!room?.name) return;
    const token = localStorage.getItem('engagio_token');
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${room.name}/breakouts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.assignments) setAssignments(data.assignments);
      })
      .catch(() => {});

    // Also fetch current broadcast state
    socket?.emit('get-broadcast-state', { sessionId }, (res: any) => {
      if (res?.status === 'ok') setIsBroadcasting(res.isBroadcasting);
    });
  }, [room?.name, sessionId, socket]);

  // Apply selective subscription + broadcast audio exception
  useEffect(() => {
    if (!room) return;

    const apply = () => {
      let localBreakoutId: string | null = null;
      try {
        const meta = JSON.parse(room.localParticipant.metadata || '{}');
        localBreakoutId = meta.breakoutRoomId || null;
      } catch {}

      room.remoteParticipants.forEach((participant) => {
        let participantBreakoutId: string | null = null;
        try {
          const meta = JSON.parse(participant.metadata || '{}');
          participantBreakoutId = meta.breakoutRoomId || null;
        } catch {}

        if (isTeacher) {
          // Teacher: subscribe to ALL participants by default (for monitoring + Control-View),
          // but when actively monitoring a specific breakout room, restrict to that room only
          // so the teacher doesn't hear audio from other rooms.
          const isMonitoringMode = isMonitoring && monitorTarget && monitorTarget !== 'main';
          if (isMonitoringMode) {
            const teacherInTarget = participantBreakoutId === monitorTarget;
            participant.trackPublications.forEach((pub) => {
              if (pub.setSubscribed) pub.setSubscribed(teacherInTarget);
            });
          } else {
            participant.trackPublications.forEach((pub) => {
              if (pub.kind === Track.Kind.Video && pub.setVideoQuality) {
                pub.setVideoQuality(0);
              }
              if (pub.setSubscribed) pub.setSubscribed(true);
            });
          }
          return;
        }

        // ── Student logic ──
        const sameRoom = participantBreakoutId === localBreakoutId;
        const bothUnassigned = !localBreakoutId && !participantBreakoutId;

        // Teacher heuristic: null/unset breakoutRoomId means teacher stays in main room
        const likelyTeacher = participantBreakoutId === null || participantBreakoutId === '';
        const isBroadcastTarget = isBroadcasting && likelyTeacher;

        participant.trackPublications.forEach((pub) => {
          if (!pub.setSubscribed) return;

          let targetSubscribed = false;

          if (isBroadcastTarget && pub.kind === Track.Kind.Audio) {
            // AUDIO BROADCAST: force subscribe to teacher audio
            targetSubscribed = true;
          } else if (sameRoom || bothUnassigned) {
            // Normal breakout room isolation
            targetSubscribed = true;
          }

          pub.setSubscribed(targetSubscribed);
        });
      });

      // Expose broadcast state for E2E introspection (always set, even with 0 participants)
      const state = {
        isBroadcasting,
        localBreakoutId,
        isTeacher,
        participants: Array.from(room.remoteParticipants.values()).map((p) => ({
          identity: p.identity,
          isSubscribed: Array.from(p.trackPublications.values()).some(
            (tp) => tp.isSubscribed
          ),
        })),
      };
      (room as any).__breakoutState = state;
      (window as any).__breakoutState = {
        ...((window as any).__breakoutState || {}),
        ...state,
      };
    };

    apply();

    room.on('participantConnected', apply);
    room.on('participantDisconnected', apply);
    room.on('participantMetadataChanged', apply);
    // Re-apply when any participant publishes or unpublishes a track
    room.on('trackPublished', apply);
    room.on('trackUnpublished', apply);

    // Periodic re-apply ensures async subscription state catches up
    const interval = setInterval(apply, 2000);

    return () => {
      room.off('participantConnected', apply);
      room.off('participantDisconnected', apply);
      room.off('participantMetadataChanged', apply);
      room.off('trackPublished', apply);
      room.off('trackUnpublished', apply);
      clearInterval(interval);
    };
  }, [room, isTeacher, userId, assignments, isBroadcasting, isMonitoring, monitorTarget]);

  return { assignments, isBroadcasting };
}

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

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Hook into breakout selective subscription (now returns { assignments, isBroadcasting })
  const { assignments: breakoutAssignments, isBroadcasting } = useBreakoutSubscription(room, isTeacher, userId || '', socket, sessionId);

  // Compute local breakout room ID for visual isolation
  const localBreakoutId = useMemo(() => {
    try {
      return JSON.parse(room.localParticipant.metadata || '{}').breakoutRoomId || null;
    } catch {
      return null;
    }
  }, [room.localParticipant.metadata]);

  const shardLabel = localBreakoutId || 'main';
  const roomLabel = localBreakoutId || 'Main Room';

  // Expose room for E2E tests
  useEffect(() => {
    (window as any).__lk_room__ = room;
    return () => { delete (window as any).__lk_room__; };
  }, [room]);

  // Sync media state from LiveKit (polls every 500ms — reliable + no event listener bugs)
  const { micMuted, cameraOff, screenShareActive } = useSyncMediaState(room);

  /* Detect breakout room assignments from metadata and show 1s loading overlay */
  useEffect(() => {
    const newRoomId = (() => {
      try { return JSON.parse(room.localParticipant.metadata || '{}').breakoutRoomId || null; }
      catch { return null; }
    })();
    const displayRoom = newRoomId || 'Main Room';
    const lastRoom = (window as any).__lastRoomId;
    if (lastRoom !== undefined && lastRoom !== displayRoom) {
      setMovingToRoom(displayRoom);
      setTimeout(() => setMovingToRoom(null), 1000);
    }
    (window as any).__lastRoomId = displayRoom;
  }, [room.localParticipant.metadata]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [sidebarOpen, setSidebarOpen] = useState(true);                  // default open on desktop
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [movingToRoom, setMovingToRoom] = useState<string | null>(null);
  const [pinnedSid, setPinnedSid] = useState<string | undefined>(undefined);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});

  // Chat state — lifted here so it survives sidebar unmount
  const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([]);

  // Poll state — lifted here so it survives sidebar unmount
  const [polls, setPolls] = useState<PollData[]>([]);
  const [activePollToast, setActivePollToast] = useState<PollData | null>(null);

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
    socket?.emit('engagementEvent', {
      type: 'HAND_RAISE',
      payload: { raised: next },
    });
    addToast({
      id: Date.now().toString(),
      message: next ? 'Hand raised' : 'Hand lowered',
      type: 'info',
    });
  }, [handRaised, socket, addToast]);

  // Listen for hand raises from other participants
  useEffect(() => {
    if (!socket) return;
    const onHandRaise = (data: any) => {
      if (!data?.userId) return;
      setRaisedHands((prev) => ({ ...prev, [data.userId]: data.raised }));
    };
    socket.on('participant-hand-raise', onHandRaise);
    return () => { socket.off('participant-hand-raise', onHandRaise); };
  }, [socket]);

  // Listen for chat messages from other participants — survives sidebar unmount
  useEffect(() => {
    if (!socket) return;
    const onChatMessage = (data: {
      id: string;
      userId: string;
      userName: string;
      text: string;
      timestamp: string;
      breakoutRoomId?: string | null;
    }) => {
      if (data.userId === userId) return; // own messages already added optimistically
      setChatMessages((prev) => [
        ...prev,
        {
          id: data.id,
          userId: data.userId,
          userName: data.userName,
          text: data.text,
          timestamp: new Date(data.timestamp),
          isOwn: false,
          breakoutRoomId: data.breakoutRoomId || null,
        },
      ]);
      // increment unread only when chat tab is not active
      setUnreadChatCount((prev) => prev + 1);
    };
    const onGlobalBroadcast = (data: { content: string; senderId: string; timestamp: string }) => {
      if (!data?.content) return;
      const msgId = `broadcast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setChatMessages((prev) => [
        ...prev,
        {
          id: msgId,
          userId: data.senderId || 'system',
          userName: 'Broadcast',
          text: data.content,
          timestamp: new Date(data.timestamp || Date.now()),
          isOwn: false,
          breakoutRoomId: 'broadcast',
        },
      ]);
      setUnreadChatCount((prev) => prev + 1);
    };
    socket.on('chat-message', onChatMessage);
    socket.on('global-broadcast-chat', onGlobalBroadcast);
    return () => {
      socket.off('chat-message', onChatMessage);
      socket.off('global-broadcast-chat', onGlobalBroadcast);
    };
  }, [socket, userId]);

  // Listen for poll events — survives sidebar unmount
  useEffect(() => {
    if (!socket) return;
    const onPollCreated = (data: any) => {
      if (!data?.id) return;
      const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
      setPolls((prev) => {
        if (prev.some((p) => p.id === data.id)) return prev;
        const poll = { ...data, status: 'active' as const };
        // Non-teachers get a popup modal
        if (!isTeacher) {
          setActivePollToast(poll);
        }
        return [...prev, poll];
      });
    };
    const onPollVote = (data: any) => {
      if (!data?.pollId || !data?.optionId) return;
      setPolls((prev) =>
        prev.map((p) =>
          p.id === data.pollId
            ? {
                ...p,
                options: p.options.map((o: { id: string; text: string; voteCount: number; percentage: number }) =>
                  o.id === data.optionId ? { ...o, voteCount: o.voteCount + 1 } : o
                ),
                totalVotes: p.totalVotes + 1,
              }
            : p
        )
      );
    };
    socket.on('poll-created', onPollCreated);
    socket.on('poll-vote', onPollVote);
    return () => {
      socket.off('poll-created', onPollCreated);
      socket.off('poll-vote', onPollVote);
    };
  }, [socket]);

  const handleToggleChat = useCallback(() => {
    setSidebarTab('chat');
    setSidebarOpen((o) => !o);
    setUnreadChatCount(0);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((o) => !o);
  }, []);

  const handleCreatePoll = useCallback((question: string, options: string[]) => {
    if (!socket) return;
    const id = `poll_${Date.now()}`;
    const pollData: PollData = {
      id,
      question,
      options: options.map((text, i) => ({ id: `opt_${i}`, text, voteCount: 0, percentage: 0 })),
      totalVotes: 0,
      status: 'active',
    };
    setPolls((prev) => [...prev, pollData]);
    socket.emit('engagementEvent', {
      type: 'POLL_CREATED',
      payload: { id, question, options: pollData.options, totalVotes: 0 },
    });
  }, [socket]);

  const handleVotePoll = useCallback((pollId: string, optionId: string) => {
    if (!socket) return;
    setPolls((prev) =>
      prev.map((p) =>
        p.id === pollId
          ? {
              ...p,
              options: p.options.map((o) =>
                o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o
              ),
              totalVotes: p.totalVotes + 1,
            }
          : p
      )
    );
    socket.emit('engagementEvent', {
      type: 'POLL_VOTE',
      payload: { pollId, optionId },
    });
  }, [socket]);

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

  const handleAddChatMessage = useCallback((msg: ChatMessageType) => {
    setChatMessages((prev) => [...prev, msg]);
  }, []);

  // Listen for nudges
  useEffect(() => {
    if (!socket) return;
    const onNudge = (data: { message: string }) => {
      addToast({
        id: `nudge_${Date.now()}`,
        message: data.message || 'Your teacher is checking in on you',
        type: 'warning',
      });
    };
    socket.on('nudge-received', onNudge);
    return () => { socket.off('nudge-received', onNudge); };
  }, [socket, addToast]);

  // ── Listen for room commands (host moderation) ──
  useEffect(() => {
    if (!socket) return;
    const onRoomCommand = (data: {
      action: 'MUTE_MIC' | 'DISABLE_CAM' | 'KICK' | 'LOWER_HAND';
      from?: string;
      targetUserId?: string;
      timestamp?: string;
    }) => {
      // Filter: if targetUserId is specified, only act when it matches current user
      if (data.targetUserId && data.targetUserId !== userId) return;

      switch (data.action) {
        case 'KICK':
          addToast({
            id: `kick_${Date.now()}`,
            message: 'You have been removed from the session by the teacher',
            type: 'error',
          });
          setTimeout(() => {
            room.disconnect();
            router.push('/dashboard?reason=kicked');
          }, 1500);
          break;
        case 'MUTE_MIC':
          room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          socket?.emit('engagementEvent', {
            type: 'MIC',
            payload: { active: false },
          });
          addToast({
            id: `mute_${Date.now()}`,
            message: 'Your microphone was muted by the teacher',
            type: 'warning',
          });
          break;
        case 'DISABLE_CAM':
          room.localParticipant.setCameraEnabled(false).catch(() => {});
          socket?.emit('engagementEvent', {
            type: 'CAMERA',
            payload: { active: false },
          });
          addToast({
            id: `cam_${Date.now()}`,
            message: 'Your camera was disabled by the teacher',
            type: 'warning',
          });
          break;
        case 'LOWER_HAND':
          setHandRaised(false);
          if (userId) setRaisedHands((prev) => ({ ...prev, [userId]: false }));
          socket?.emit('engagementEvent', {
            type: 'HAND_RAISE',
            payload: { raised: false },
          });
          addToast({
            id: `hand_${Date.now()}`,
            message: 'Your hand was lowered by the teacher',
            type: 'info',
          });
          break;
      }
    };
    socket.on('room-command', onRoomCommand);
    return () => { socket.off('room-command', onRoomCommand); };
  }, [socket, userId, room, router, addToast]);

  return (
      <>
      {/* Floating Header — sticky to avoid overlapping sidebar */}
      <div className="sticky top-0 z-50">
        <GlassHeader
          connected={room.state === 'connected'}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onLeave={handleLeave}
          participantCount={room.numParticipants}
          roomLabel={roomLabel}
        />
      </div>
      {/* Student Global Announcement banner when broadcast is active */}
      {!isTeacher && isBroadcasting && (
        <div className="sticky top-14 z-40 bg-engagio-600/20 border-b border-engagio-500/30 px-4 py-1.5 text-center">
          <p className="text-xs font-medium text-engagio-300">
            🔊 Global Announcement — Your teacher is broadcasting audio to all rooms
          </p>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden relative md:pt-14">
        {/* ── Sidebar ── */}
        {/* Desktop: inline flex; Mobile: hidden by default, conditionally shown */}
        <div className={`flex-shrink-0 hidden md:flex h-full ${sidebarOpen ? '' : 'w-0'}`}>
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
            raisedHands={raisedHands}
            chatMessages={chatMessages}
            onAddChatMessage={handleAddChatMessage}
            isTeacher={isTeacher}
            polls={polls}
            onCreatePoll={handleCreatePoll}
            onVotePoll={handleVotePoll}
            breakoutRoomId={localBreakoutId}
            availableRooms={Array.from(new Set(['main', ...(Object.values(breakoutAssignments || {}))]))}
            onToast={addToast}
          />
        </div>

        {/* Mobile: sidebar as overlay when open */}
        <div className={`md:hidden flex h-full absolute inset-0 z-40 ${sidebarOpen ? '' : 'pointer-events-none'}`}>
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
            raisedHands={raisedHands}
            chatMessages={chatMessages}
            onAddChatMessage={handleAddChatMessage}
            isTeacher={isTeacher}
            polls={polls}
            onCreatePoll={handleCreatePoll}
            onVotePoll={handleVotePoll}
            breakoutRoomId={localBreakoutId}
            availableRooms={Array.from(new Set(['main', ...(Object.values(breakoutAssignments || {}))]))}
            onToast={addToast}
          />
        </div>

        {/* ── Main Stage ── */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <FocusLayout
            viewMode={viewMode}
            pinnedParticipantSid={pinnedSid}
            onPinParticipant={handlePinParticipant}
            isTeacher={isTeacher}
            shardLabel={shardLabel}
          />
          {/* Moving to breakout room overlay */}
          {movingToRoom && (
            <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-engagio-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-sm font-medium">Moving to {movingToRoom}…</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Toolbar ── */}
      {/* Sibling to main content — never inside the sidebar */}
      <div className="toolbar-container">
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
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          canPresent={isTeacher || (() => { try { return !!JSON.parse(room.localParticipant.metadata || '{}').breakoutRoomId; } catch { return false; } })()}
        />
      </div>

      {/* Active Poll Popup Modal */}
      {activePollToast && (
        <PollToast
          poll={activePollToast}
          onVote={(pid, oid) => {
            handleVotePoll(pid, oid);
            setActivePollToast(null);
          }}
          onDismiss={() => setActivePollToast(null)}
        />
      )}

      {/* Quiz Overlay for students */}
      <QuizOverlayPortal socket={socket} userId={userId || ''} />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

function QuizOverlayPortal({ socket, userId }: { socket: Socket | null; userId: string }) {
  const { quizState, timer, hasSubmitted, isDisabled, correctResult, submitAnswer, currentQuestionIndex } =
    useQuizSocket(socket, userId);

  if (quizState.kind !== 'active') return null;
  return (
    <QuizOverlay
      question={quizState.question}
      questionIndex={currentQuestionIndex}
      timer={timer}
      isDisabled={isDisabled}
      correctResult={correctResult}
      onSubmitAnswer={submitAnswer}
    />
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
