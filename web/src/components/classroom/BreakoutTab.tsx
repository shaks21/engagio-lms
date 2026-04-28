'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { LogOut, Shuffle, Users, Layers, Radio, RadioOff, Eye, Loader, Move, Plus, Minus, X } from 'lucide-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { useAuth } from '@/lib/auth-context';
import { useEngagement } from '@/hooks/useEngagement';
import RoomMonitorModal from './RoomMonitorModal';

interface BreakoutTabProps {
  roomName: string;
  socket?: any;
}

/* ─── types ─── */
interface Student {
  identity: string;
  name: string;
  isLocal: boolean;
  isTeacher: boolean;  isSpeaking: boolean;
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

/* ─── Main component ─── */
export default function BreakoutTab({ roomName, socket }: BreakoutTabProps) {
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
      /* skip duplicate of local participant (livekit sometimes includes it) */
      if (localParticipant && p.identity === localParticipant.identity) return;
      // Derive teacher status from LiveKit metadata if available, else false
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

  const students = participants.filter((p) => !p.isTeacher);
  const totalParticipants = participants.length;

  /* deduplicated student count (excludes duplicate identity entries) */
  const studentCount = useMemo(() => {
    return new Set(students.map((s) => s.identity)).size;
  }, [students]);

  /* ── state ── */
  const [roomCount, setRoomCount] = useState(2);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [allocationMode, setAllocationMode] = useState<AllocationMode | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState<string | null>(null);
  const [peekMode, setPeekMode] = useState(true);
  const [showMonitorModal, setShowMonitorModal] = useState(false);

  /* derived computed assignments merged from backend + local overrides */
  const mergedAssignments = useMemo(() => {
    return { ...assignments };
  }, [assignments]);

  /* grouped students by room (includes manual overrides) */
  const groups = useMemo(() => {
    const g: Record<string, Student[]> = {};
    students.forEach((s) => {
      const roomId = mergedAssignments[s.identity] || s.breakoutRoomId || 'main';
      if (!g[roomId]) g[roomId] = [];
      g[roomId].push(s);
    });
    return g;
  }, [students, mergedAssignments]);

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
      (window as any).__breakoutState = {
        ...((window as any).__breakoutState || {}),
        isMonitoring: payload.action === 'START_MONITOR',
        monitorTarget: payload.roomId || null,
        peekMode: payload.peekMode !== false,
      };
    };
    socket.emit('get-monitor-state', { sessionId: roomName }, (res: any) => {
      if (res?.monitorTarget) {
        setIsMonitoring(true);
        setMonitorTarget(res.monitorTarget);
        setPeekMode(res.peekMode !== false);
      }
      (window as any).__breakoutState = {
        ...((window as any).__breakoutState || {}),
        isMonitoring: !!res?.monitorTarget,
        monitorTarget: res?.monitorTarget || null,
        peekMode: res?.peekMode !== false,
      };
    });
    socket.on('teacher-monitor-state', onMonitorState);
    return () => { socket.off('teacher-monitor-state', onMonitorState); };
  }, [socket, roomName]);

  /* ── handlers ── */

  const handleShuffle = useCallback(async () => {
    if (!socket || !roomName) return;
    setLoading(true);
    setAllocationMode('AUTO');
    const token = localStorage.getItem('engagio_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ groupCount: roomCount }),
      });
      if (!res.ok) throw new Error(`Shuffle failed: ${res.status}`);
      const data = await res.json();
      if (data.assignments) setAssignments(data.assignments);
    } catch (e) {
      console.error('[BreakoutTab] Shuffle error:', e);
      alert('Failed to shuffle rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [socket, roomName, roomCount]);

  const handleCloseAllRooms = useCallback(async () => {
    if (!socket || !roomName) return;
    setLoading(true);
    const token = localStorage.getItem('engagio_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts/clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error(`Close rooms failed: ${res.status}`);
      setAssignments({});
      setAllocationMode(null);
    } catch (e) {
      console.error('[BreakoutTab] Close All Rooms error:', e);
      alert('Failed to close breakout rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [socket, roomName]);

  const handleToggleBroadcast = useCallback(() => {
    if (!socket || !roomName) return;
    const enable = !isBroadcasting;
    socket.emit('toggle-broadcast', { sessionId: roomName, enable }, (res: any) => {
      if (res?.status === 'ok') setIsBroadcasting(res.isBroadcasting);
    });
  }, [socket, roomName, isBroadcasting]);

  /* manual allocation helpers */
  const moveStudent = useCallback((identity: string, toRoomId: string | null) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (toRoomId === null) {
        delete next[identity];
      } else {
        next[identity] = toRoomId;
      }
      return next;
    });
  }, []);

  const applyManualAssignments = useCallback(async () => {
    if (!roomName) return;
    setLoading(true);
    const token = localStorage.getItem('engagio_token');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ assignments }),
      });
      if (!res.ok) throw new Error(`Manual assign failed: ${res.status}`);
      setAllocationMode(null);
    } catch (e) {
      console.error('[BreakoutTab] Manual save error:', e);
      alert('Failed to save manual assignments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [roomName, assignments]);

  /* compute per-room capacity hint */
  const capacityHint = useMemo(() => {
    if (studentCount === 0) return '';
    const perRoom = Math.ceil(studentCount / roomCount);
    return `~${perRoom} student${perRoom !== 1 ? 's' : ''} per room`;
  }, [studentCount, roomCount]);

  /* room IDs for rendering (excluding 'main') */
  const roomIds = useMemo(() => {
    return Object.keys(groups).filter((id) => id !== 'main');
  }, [groups]);

  /* unassigned students for manual mode */
  const unassignedStudents = useMemo(() => {
    return students.filter((s) => {
      const assignedRoom = mergedAssignments[s.identity] || s.breakoutRoomId;
      return !assignedRoom || assignedRoom === 'main';
    });
  }, [students, mergedAssignments]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with monitoring controls */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Breakout Rooms</p>
          <div className="flex items-center gap-2">
            {isTeacher && (
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
            )}
            {isTeacher && (
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
            )}
            <button
              onClick={handleToggleBroadcast}
              disabled={loading}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isBroadcasting
                  ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                  : 'bg-engagio-600/20 text-engagio-400 border border-engagio-500/30 hover:bg-engagio-600/30'
              }`}
            >
              {isBroadcasting ? <RadioOff className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
              {isBroadcasting ? 'Stop Broadcast' : 'Broadcast Audio'}
            </button>
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

        {/* Teacher controls: room count + shuffle + manual */}
        {isTeacher && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400">Rooms:</label>
              <select
                data-testid="breakout-room-count"
                value={roomCount}
                onChange={(e) => setRoomCount(parseInt(e.target.value, 10))}
                className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-engagio-500"
              >
                {Array.from({ length: MAX_ROOMS }, (_, i) => i + 1).map((n) => {
                  const perRoom = studentCount > 0 ? Math.ceil(studentCount / n) : 0;
                  const label = studentCount > 0
                    ? `${n} room${n !== 1 ? 's' : ''} (~${perRoom} each)`
                    : `${n} room${n !== 1 ? 's' : ''}`;
                  return (
                    <option key={n} value={n}>{label}</option>
                  );
                })}
              </select>
              <span data-testid="room-capacity-hint" className="text-[10px] text-gray-500">
                {studentCount > 0 ? capacityHint : 'No students'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShuffle}
                disabled={loading || totalParticipants === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-engagio-600/20 hover:bg-engagio-600/30 disabled:opacity-50 border border-engagio-500/30 text-engagio-400 text-xs font-medium transition-colors"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                Auto Shuffle
              </button>
              <button
                onClick={() => setAllocationMode(allocationMode === 'MANUAL' ? null : 'MANUAL')}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  allocationMode === 'MANUAL'
                    ? 'bg-engagio-600/40 border-engagio-500/50 text-engagio-300'
                    : 'bg-gray-700/30 border-gray-600/30 text-gray-400 hover:bg-gray-700/50'
                } disabled:opacity-50`}
              >
                <Users className="w-4 h-4" />
                Manual Allocation
              </button>
              <button
                onClick={handleCloseAllRooms}
                disabled={loading || Object.keys(assignments).length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 border border-red-500/30 text-red-400 text-xs font-medium transition-colors"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Close All Rooms
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Manual Allocation Mode ── */}
      {allocationMode === 'MANUAL' && isTeacher && (
        <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-2">
          {/* Unassigned pool */}
          <div data-testid="unassigned-pool" className="border border-dashed border-gray-600 rounded-lg bg-gray-800/20 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-300">Unassigned</span>
              <span className="text-[10px] text-gray-500">{unassignedStudents.length} student{unassignedStudents.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1">
              {unassignedStudents.length === 0 && (
                <p className="text-[10px] text-gray-500 text-center py-1">All students assigned</p>
              )}
              {unassignedStudents.map((s) => (
                <div key={s.identity} className="flex items-center justify-between bg-gray-800/40 rounded px-2 py-1">
                  <StudentAvatar participant={s} scores={engagementScores} />
                </div>
              ))}
            </div>
          </div>

          {/* Room columns */}
          <div className="grid grid-cols-1 gap-2">
            {Array.from({ length: roomCount }, (_, i) => `room-${String.fromCharCode(97 + i)}`).map((roomId, idx) => {
              const members = groups[roomId] || [];
              return (
                <div key={roomId} data-testid="breakout-room-card" className="border border-gray-700/50 rounded-lg bg-gray-800/30">
                  <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <HealthDot status={roomHealth[roomId]?.status || 'red'} />
                      <span className="text-sm font-medium text-white">{roomId}</span>
                      <span data-testid="room-student-count" className="text-[10px] text-gray-500">{members.length} student{members.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {members.map((m) => (
                      <div key={m.identity} className="flex items-center justify-between bg-gray-800/40 rounded px-2 py-1">
                        <StudentAvatar participant={m} scores={engagementScores} />
                        <button
                          onClick={() => moveStudent(m.identity, null)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                          title="Move to unassigned"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {/* Dropped unassigned can be added here via buttons */}
                    {unassignedStudents.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1">
                        <span className="text-[10px] text-gray-500 mr-1">Assign:</span>
                        {unassignedStudents.map((s) => (
                          <button
                            key={s.identity}
                            data-testid={`assign-to-room-${idx}`}
                            onClick={() => moveStudent(s.identity, roomId)}
                            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-engagio-600/20 text-engagio-400 hover:bg-engagio-600/40 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            {s.name || s.identity}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={applyManualAssignments}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-engagio-600/30 hover:bg-engagio-600/50 disabled:opacity-50 border border-engagio-500/30 text-engagio-300 text-xs font-medium transition-colors"
            >
              {loading && <Loader className="w-3.5 h-3.5 animate-spin" />}
              Save Allocations
            </button>
            <button
              onClick={() => setAllocationMode(null)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 text-gray-400 text-xs font-medium transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Normal View (auto mode or not editing manual) ── */}
      {(allocationMode !== 'MANUAL') && (
        <>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-2">
            {Object.keys(groups).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No participants yet</p>
            )}
            {Object.entries(groups).map(([roomId, members]) => {
              if (roomId === 'main') {
                // If no assignments exist yet, show all students in main
                if (Object.keys(assignments).length === 0) {
                  return (
                    <div key="main" className="border border-gray-700/50 rounded-lg bg-gray-800/30">
                      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700/30">
                        <span className="text-sm font-medium text-white">Main Room</span>
                        <span className="text-[10px] text-gray-500">{members.length} student{members.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="p-2 space-y-1.5">
                        {members.map((m) => (
                          <StudentAvatar key={m.identity} participant={m} scores={engagementScores} />
                        ))}
                      </div>
                    </div>
                  );
                }
                return null; // hide empty main when rooms exist
              }

              const health = roomHealth[roomId] || { avg: 0, count: members.length, status: 'red' as const };
              return (
                <div
                  key={roomId}
                  data-testid="breakout-room-card"
                  className="border border-gray-700/50 rounded-lg bg-gray-800/30"
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <HealthDot status={health.status} />
                      <span className="text-sm font-medium text-white">{roomId}</span>
                      <span data-testid="room-student-count" className="text-[10px] text-gray-500">{members.length} student{members.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTeacher && (
                        <button
                          onClick={() => {
                            if (!socket) return;
                            const notify = !peekMode;
                            socket.emit('monitor-room', {
                              sessionId: roomName,
                              roomId,
                              peekMode,
                              notify,
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
                      )}
                      <span className="text-xs font-semibold text-gray-300">Avg: {health.avg}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {members.map((m) => (
                      <StudentAvatar key={m.identity} participant={m} scores={engagementScores} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

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
    </div>
  );
}
