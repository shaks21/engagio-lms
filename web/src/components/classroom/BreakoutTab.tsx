'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { LogOut, Eye, ArrowRight, Loader, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { useAuth } from '@/lib/auth-context';
import { useEngagement } from '@/hooks/useEngagement';
import RoomMonitorModal from './RoomMonitorModal';
import CreateBreakoutModal from './CreateBreakoutModal';

interface BreakoutTabProps {
  roomName: string;
  socket?: any;
  onToast?: (toast: { id: string; message: string; type?: 'info' | 'success' | 'warning' | 'error' }) => void;
}

/* ─── types ─── */
interface Student {
  identity: string;
  name: string;
  isLocal: boolean;
  isTeacher: boolean;
  isSpeaking: boolean;
  breakoutRoomId: string | null;
}

type AllocationMode = 'AUTO' | 'MANUAL' | 'SELF_SELECT';

const MAX_ROOMS = 25;

/* ─── Health dot colour based on average score ─── */
function getHealthStatus(avg: number): 'green' | 'yellow' | 'red' {
  if (avg >= 70) return 'green';
  if (avg >= 40) return 'yellow';
  return 'red';
}

function HealthDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: 'bg-green-500 shadow-green-500/50',
    yellow: 'bg-yellow-400 shadow-yellow-400/50',
    red: 'bg-red-500 shadow-red-500/50',
  };
  return (
    <span
      data-testid="room-health-dot"
      data-status={status}
      className={`inline-block w-2.5 h-2.5 rounded-full shadow ${colors[status]}`}
    />
  );
}

/* ─── Student avatar with voice-activity ring ─── */
function StudentAvatar({ participant, scores }: { participant: any; scores: any[] }) {
  const isSpeaking = participant.isSpeaking || false;
  const scoreEntry = scores.find((s) => s.userId === participant.identity);
  const score = scoreEntry?.score ?? null;
  const initials = (participant.name || participant.identity || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2" data-testid="student-avatar">
      <div className={`relative flex-shrink-0`}>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
            isSpeaking
              ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900 bg-green-700 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
          title={isSpeaking ? 'Speaking' : 'Silent'}
        >
          {initials}
        </div>
        {isSpeaking && (
          <span
            data-testid="speaking-pulse"
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-gray-900 animate-pulse"
          />
        )}
      </div>
      <span className="text-xs text-gray-300 truncate">{participant.name || participant.identity}</span>
      {score !== null && (
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium ${
          score >= 70 ? 'bg-green-900/40 text-green-400' : score >= 40 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'
        }`}>Score {score}</span>
      )}
    </div>
  );
}

/* ─── Room allocation label helper for dropdown options ─── */
function getRoomAllocationLabel(roomCount: number, studentCount: number): string {
  const base = `${roomCount} room${roomCount !== 1 ? 's' : ''}`;
  if (studentCount === 0) return base;
  if (roomCount === 1) return `${base} — ${studentCount} students`;

  const perRoom = Math.floor(studentCount / roomCount);
  const remainder = studentCount % roomCount;
  const emptyRooms = Math.max(0, roomCount - studentCount);

  if (emptyRooms > 0) {
    return `${base} — ${studentCount} students (${perRoom > 0 ? `${perRoom} each` : '1 each'}, ${emptyRooms} empty)`;
  }
  if (remainder === 0) {
    return `${base} — ${studentCount} students (${perRoom} each)`;
  }
  return `${base} — ${studentCount} students (${perRoom}–${perRoom + 1} each)`;
}

/* ─── Main component ─── */
export default function BreakoutTab({ roomName, socket, onToast }: BreakoutTabProps) {
  const livekitParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { scores: engagementScores } = useEngagement(roomName, undefined, true);

  /* build participant list */
  const participants = useMemo(() => {
    const all: Student[] = [];
    if (localParticipant) {
      all.push({
        identity: localParticipant.identity,
        name: localParticipant.name || localParticipant.identity,
        isLocal: true,
        isTeacher,
        isSpeaking: localParticipant.isSpeaking,
        breakoutRoomId: (() => {
          try { return JSON.parse(localParticipant.metadata || '{}').breakoutRoomId || null; }
          catch { return null; }
        })(),
      });
    }
    livekitParticipants.forEach((p) => {
      /* skip duplicate of local participant */
      if (localParticipant && p.identity === localParticipant.identity) return;
      const remoteRole = (() => {
        try { return JSON.parse(p.metadata || '{}').role || ''; }
        catch { return ''; }
      })();
      all.push({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal: false,
        isTeacher: remoteRole === 'teacher' || remoteRole === 'TEACHER',
        isSpeaking: p.isSpeaking,
        breakoutRoomId: (() => {
          try { return JSON.parse(p.metadata || '{}').breakoutRoomId || null; }
          catch { return null; }
        })(),
      });
    });
    return all;
  }, [livekitParticipants, localParticipant, isTeacher]);

  const assignableParticipants = participants;
  const remoteStudents = participants.filter((p) => !p.isLocal && !p.isTeacher);
  const studentCount = useMemo(() => {
    return new Set(remoteStudents.map((s) => s.identity)).size;
  }, [remoteStudents]);

  /* ── state ── */
  const [roomCount, setRoomCount] = useState(2);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState<string | null>(null);
  const [peekMode, setPeekMode] = useState(true);
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

  /* current user's room */
  const myRoomId = useMemo(() => {
    try { return JSON.parse(localParticipant?.metadata || '{}').breakoutRoomId || 'main'; }
    catch { return 'main'; }
  }, [localParticipant?.metadata]);

  /* grouped participants by room */
  const groups = useMemo(() => {
    const g: Record<string, Student[]> = {};
    g['main'] = [];
    const activeRoomCount = Math.max(1, roomCount);
    for (let i = 0; i < activeRoomCount; i++) {
      g[`room-${String.fromCharCode(97 + i)}`] = [];
    }
    assignableParticipants.forEach((s) => {
      const roomId = assignments[s.identity] || s.breakoutRoomId || 'main';
      if (!g[roomId]) g[roomId] = [];
      g[roomId].push(s);
    });
    return g;
  }, [assignableParticipants, assignments, roomCount]);

  /* room health */
  const roomHealth = useMemo(() => {
    const health: Record<string, { avg: number; count: number; status: 'green' | 'yellow' | 'red' }> = {};
    for (const roomId of Object.keys(groups)) {
      const members = groups[roomId];
      const memberIds = new Set(members.map((m) => m.identity));
      const roomScores = engagementScores.filter((s) => memberIds.has(s.userId));
      const avg = roomScores.length > 0
        ? Math.round(roomScores.reduce((sum, s) => sum + s.score, 0) / roomScores.length)
        : 0;
      health[roomId] = { avg, count: members.length, status: getHealthStatus(avg) };
    }
    return health;
  }, [groups, engagementScores]);

  /* fetch current assignments on mount */
  React.useEffect(() => {
    const token = localStorage.getItem('engagio_token');
    if (!token || !roomName) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.assignments) setAssignments(data.assignments);
        if (data.groupCount && data.groupCount >= 1 && data.groupCount <= MAX_ROOMS) {
          setRoomCount(data.groupCount);
        }
      })
      .catch(() => {});
  }, [roomName]);

  /* socket broadcast state sync */
  React.useEffect(() => {
    if (!socket) return;
    const onState = (payload: any) => {
      setIsBroadcasting(Boolean(payload.isBroadcasting));
      (window as any).__breakoutState = { isBroadcasting: Boolean(payload.isBroadcasting), breakoutRoomId: payload.breakoutRoomId };
    };
    socket.emit('get-broadcast-state', { sessionId: roomName }, (res: any) => {
      if (res) {
        setIsBroadcasting(Boolean(res.isBroadcasting));
        (window as any).__breakoutState = { isBroadcasting: Boolean(res.isBroadcasting), breakoutRoomId: res.breakoutRoomId };
      }
    });
    socket.on('broadcast-state-changed', onState);
    return () => { socket.off('broadcast-state-changed', onState); };
  }, [socket, roomName, localParticipant?.identity]);

  /* socket monitor state sync */
  React.useEffect(() => {
    if (!socket) return;
    const onMonitorState = (payload: any) => {
      if (payload.action === 'START_MONITOR') {
        setIsMonitoring(true);
        setMonitorTarget(payload.roomId);
        setPeekMode(payload.peekMode !== false);
      } else if (payload.action === 'STOP_MONITOR') {
        setIsMonitoring(false);
        setMonitorTarget(null);
      }
    };
    socket.emit('get-monitor-state', { sessionId: roomName }, (res: any) => {
      if (res?.monitorTarget) {
        setIsMonitoring(true);
        setMonitorTarget(res.monitorTarget);
        setPeekMode(res.peekMode !== false);
      }
    });
    socket.on('teacher-monitor-state', onMonitorState);
    return () => { socket.off('teacher-monitor-state', onMonitorState); };
  }, [socket, roomName]);

  /* ── handlers ── */

  const handleCloseAllRooms = useCallback(async () => {
    if (!roomName) return;
    setLoading(true);
    const token = localStorage.getItem('engagio_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts/clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Close rooms failed: ${res.status} ${body}`);
      }
      setAssignments({});
      setRoomCount(2);
      onToast?.({ id: Date.now().toString(), message: 'All rooms closed', type: 'success' });
    } catch (e: any) {
      onToast?.({ id: Date.now().toString(), message: e.message || 'Failed to close rooms', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [roomName, onToast]);

  const handleToggleBroadcast = useCallback(() => {
    if (!socket || !roomName) return;
    const enable = !isBroadcasting;
    socket.emit('toggle-broadcast', { sessionId: roomName, enable }, (res: any) => {
      if (res?.status === 'ok') setIsBroadcasting(res.isBroadcasting);
    });
  }, [socket, roomName, isBroadcasting]);

  const handleModalCreated = useCallback((
    newAssignments: Record<string, string>,
    newRoomCount: number,
    mode: AllocationMode
  ) => {
    setAssignments(newAssignments);
    setRoomCount(newRoomCount);
    setShowCreateModal(false);
    onToast?.({
      id: Date.now().toString(),
      message: mode === 'AUTO'
        ? `${newRoomCount} breakout rooms created with auto-shuffle`
        : mode === 'MANUAL'
        ? `${newRoomCount} breakout rooms created with manual allocation`
        : `${newRoomCount} breakout rooms created — students can self-select`,
      type: 'success',
    });
  }, [onToast]);

  const toggleRoomExpand = useCallback((roomId: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }, []);

  /* check if any rooms have assignments */
  const hasAssignments = useMemo(() => {
    return Object.keys(assignments).length > 0 && Object.values(assignments).some((r) => r !== 'main');
  }, [assignments]);

  const roomIds = useMemo(() => {
    return Object.keys(groups).filter((id) => id !== 'main');
  }, [groups]);

  /* prepare students array for modal */
  const modalStudents = useMemo(() => {
    return remoteStudents.map((s) => ({ identity: s.identity, name: s.name }));
  }, [remoteStudents]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Breakout Rooms</p>
          <div className="flex items-center gap-2">
            {isTeacher && (
              <>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="peek-visibility-toggle"
                    checked={peekMode}
                    onChange={(e) => setPeekMode(e.target.checked)}
                    className="w-3 h-3 accent-engagio-500 rounded"
                  />
                  Peek
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="notify-students-toggle"
                    checked={!peekMode}
                    onChange={(e) => setPeekMode(!e.target.checked)}
                    className="w-3 h-3 accent-engagio-500 rounded"
                  />
                  Notify
                </label>
                <button
                  data-testid="broadcast-audio-btn"
                  onClick={handleToggleBroadcast}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isBroadcasting
                      ? 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30'
                      : 'bg-engagio-600/20 text-engagio-400 border border-engagio-500/30 hover:bg-engagio-600/30'
                  }`}
                >
                  {isBroadcasting ? 'Stop Broadcast' : 'Broadcast Audio'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Active monitoring indicator */}
        {isMonitoring && monitorTarget && (
          <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-500/20 rounded-md px-2.5 py-1">
            <span className="text-[10px] text-yellow-400">
              {peekMode ? '👻' : '👁'} Monitoring {monitorTarget} ({peekMode ? 'invisible' : 'visible'})
            </span>
            <button
              onClick={() => {
                if (!socket) return;
                setShowMonitorModal(false);
                socket.emit('stop-monitor', { sessionId: roomName }, (res: any) => {
                  if (res?.status === 'ok') { setIsMonitoring(false); setMonitorTarget(null); }
                });
              }}
              data-testid="stop-monitor"
              className="text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Stop
            </button>
          </div>
        )}

        {/* Live broadcast indicator for students */}
        {isBroadcasting && (
          <div
            data-testid="live-broadcast-indicator"
            className="flex items-center justify-between bg-green-900/20 border border-green-500/20 rounded-md px-2.5 py-1"
          >
            <span className="text-[10px] text-green-400 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Teacher is broadcasting audio
            </span>
          </div>
        )}

        {/* Teacher: Create / Close All buttons */}
        {isTeacher && (
          <div className="flex items-center gap-2 pt-1">
            <button
              data-testid="create-rooms-btn"
              onClick={() => setShowCreateModal(true)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 border border-blue-500/30 text-blue-400 text-xs font-medium transition-colors"
            >
              {loading && <Loader className="w-3.5 h-3.5 animate-spin" />}
              <Plus className="w-3.5 h-3.5" />
              {hasAssignments ? 'Configure Rooms' : 'Create Rooms'}
            </button>
            {hasAssignments && (
              <button
                data-testid="close-all-rooms-btn"
                onClick={handleCloseAllRooms}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 border border-red-500/30 text-red-400 text-xs font-medium transition-colors"
              >
                Close All →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Room List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-2">
        {/* Main Room card */}
        <div
          data-testid="breakout-room-card"
          className="border border-gray-700/50 rounded-lg bg-gray-800/30 overflow-hidden"
        >
          <div
            onClick={() => toggleRoomExpand('main')}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-800/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <HealthDot status={roomHealth['main']?.status || 'red'} />
              <span className="text-sm font-medium text-white">Main Room</span>
            </div>
            <div className="flex items-center gap-3">
              <span data-testid="room-student-count" className="text-[10px] text-gray-500">
                {(groups['main'] || []).length} student{(groups['main'] || []).length !== 1 ? 's' : ''}
              </span>
              {expandedRooms.has('main') ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </div>
          </div>
          {expandedRooms.has('main') && (
            <div className="px-3 pb-2.5 space-y-1.5">
              {(groups['main'] || []).map((m) => (
                <div key={m.identity} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <StudentAvatar participant={m} scores={engagementScores} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Breakout room cards */}
        {roomIds.map((roomId) => {
          const members = groups[roomId] || [];
          const health = roomHealth[roomId] || { avg: 0, count: members.length, status: 'red' as const };
          const isExpanded = expandedRooms.has(roomId);

          return (
            <div
              key={roomId}
              data-testid="breakout-room-card"
              className="border border-gray-700/50 rounded-lg bg-gray-800/30 overflow-hidden"
            >
              <div
                className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-800/40 transition-colors cursor-pointer"
                onClick={() => toggleRoomExpand(roomId)}
              >
                <div className="flex items-center gap-2">
                  <HealthDot status={health.status} />
                  <span className="text-sm font-medium text-white">{roomId}</span>
                  <span data-testid="room-student-count" className="text-[10px] text-gray-500">
                    {members.length} student{members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {isTeacher && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!socket) return;
                          socket.emit('monitor-room', {
                            sessionId: roomName,
                            roomId,
                            peekMode,
                            notify: !peekMode,
                          }, (res: any) => {
                            if (res?.status === 'ok') {
                              setIsMonitoring(true);
                              setMonitorTarget(roomId);
                              setShowMonitorModal(true);
                            }
                          });
                        }}
                        data-testid={`monitor-room-${roomId}`}
                        className="text-[10px] text-engagio-400 hover:text-engagio-300 transition-colors flex items-center gap-0.5"
                      >
                        <Eye className="w-3 h-3" /> Monitor
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!socket) return;
                          socket.emit('join-breakout-room', {
                            sessionId: roomName,
                            roomId,
                          });
                        }}
                        data-testid={`join-room-${roomId}`}
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
                      >
                        <ArrowRight className="w-3 h-3" /> Join
                      </button>
                    </>
                  )}
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-2.5 space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500">Avg: {health.avg}</span>
                  </div>
                  {members.map((m) => (
                    <div key={m.identity} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <StudentAvatar participant={m} scores={engagementScores} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {roomIds.length === 0 && !hasAssignments && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 text-center">No breakout rooms yet</p>
            {isTeacher && (
              <p className="text-xs text-gray-600 text-center">Click "Create Rooms" to get started</p>
            )}
          </div>
        )}
      </div>

      {/* Monitor modal */}
      {showMonitorModal && monitorTarget && (
        <RoomMonitorModal
          roomCode={monitorTarget}
          onClose={() => {
            setShowMonitorModal(false);
            setIsMonitoring(false);
            setMonitorTarget(null);
            if (socket) {
              socket.emit('stop-monitor', { sessionId: roomName }, (res: any) => {
                if (res?.status === 'ok') { setIsMonitoring(false); setMonitorTarget(null); }
              });
            }
          }}
        />
      )}

      {/* Create breakout modal */}
      {showCreateModal && (
        <CreateBreakoutModal
          roomName={roomName}
          students={modalStudents}
          currentRoomCount={roomCount}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleModalCreated}
        />
      )}
    </div>
  );
}
