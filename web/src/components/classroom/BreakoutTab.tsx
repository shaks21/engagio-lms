'use client';

import React, { useState } from 'react';
import { LogOut, Shuffle, Eye, Loader, X, UserPlus } from 'lucide-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { useAuth } from '@/lib/auth-context';
import { useEngagement } from '@/hooks/useEngagement';

interface BreakoutTabProps {
  roomName: string;
  socket?: any;
}

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
function StudentAvatar({ participant, scores, actions }: { participant: any; scores: any[]; actions?: React.ReactNode }) {
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
      <div className="relative flex-shrink-0">
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
      <span className="text-xs text-gray-300 truncate flex-1">{participant.name || participant.identity}</span>
      {score !== null && (
        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium ${
          score >= 70 ? 'bg-green-900/40 text-green-400' : score >= 40 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-red-900/40 text-red-400'
        }`}>Score {score}</span>
      )}
      {actions}
    </div>
  );
}

export default function BreakoutTab({ roomName, socket }: BreakoutTabProps) {
  const livekitParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  const { scores: engagementScores } = useEngagement(roomName, undefined, true);

  // Build participant list from LiveKit state
  const participants = React.useMemo(() => {
    const all: any[] = [];
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
      all.push({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal: false,
        isTeacher: false,
        isSpeaking: p.isSpeaking,
        breakoutRoomId: (() => {
          try { return JSON.parse(p.metadata || '{}').breakoutRoomId || null; }
          catch { return null; }
        })(),
      });
    });
    return all;
  }, [livekitParticipants, localParticipant, isTeacher]);

  const students = participants.filter((p: any) => !p.isTeacher);

  // ── Room count state ──
  const [roomCount, setRoomCount] = useState(2);
  const maxRooms = 25;

  // Capacity hint: ceil(students / roomCount)
  const capacityHint = students.length > 0
    ? `${Math.ceil(students.length / roomCount)} student${Math.ceil(students.length / roomCount) !== 1 ? 's' : ''} per room`
    : '–';

  // Manual allocation mode
  const [isManualMode, setIsManualMode] = useState(false);

  // Broadcast state synced from socket 'broadcast-state' event
  const [isBroadcasting, setIsBroadcasting] = useState(false);

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
    return () => {
      socket.off('broadcast-state-changed', onState);
    };
  }, [socket, roomName, localParticipant?.identity]);

  // Monitor state synced from socket
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState<string | null>(null);
  const [peekMode, setPeekMode] = useState(true);

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

  // Fetch current assignments on mount
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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

  // Group by room (using LiveKit metadata first, fallback to assignments from API)
  const groups = React.useMemo(() => {
    const g: Record<string, any[]> = {};
    students.forEach((s) => {
      const roomId = s.breakoutRoomId || assignments[s.identity] || 'main';
      if (!g[roomId]) g[roomId] = [];
      g[roomId].push(s);
    });
    return g;
  }, [students, assignments]);

  // Unassigned students: those in 'main' room and those not in assignments
  const unassignedStudents = React.useMemo(() => {
    return students.filter((s) => {
      const inLiveKit = s.breakoutRoomId === null || s.breakoutRoomId === undefined;
      const inApi = !assignments[s.identity] || assignments[s.identity] === 'main';
      return inLiveKit && inApi;
    });
  }, [students, assignments]);

  // Compute average engagement per room
  const roomHealth = React.useMemo(() => {
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

  // ── Close All Rooms handler ──
  const handleCloseAllRooms = async () => {
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
      setIsManualMode(false);
    } catch (e) {
      console.error('[BreakoutTab] Close All Rooms error:', e);
      alert('Failed to close breakout rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-shuffle handler ──
  const handleShuffle = async () => {
    if (!socket || !roomName) return;
    setLoading(true);
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
      setIsManualMode(false);
    } catch (e) {
      console.error('[BreakoutTab] Shuffle error:', e);
      alert('Failed to shuffle rooms. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Save manual assignment ──
  const handleAssignStudent = async (studentIdentity: string, roomId: string | null) => {
    if (!socket || !roomName) return;
    const token = localStorage.getItem('engagio_token');
    try {
      const body = roomId
        ? { assignments: { [studentIdentity]: roomId } }
        : { assignments: { [studentIdentity]: null } }; // null = truly unassigned
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Assign failed: ${res.status}`);
      // Refresh assignments
      const getRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts`, {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (getRes.ok) {
        const data = await getRes.json();
        if (data.assignments) setAssignments(data.assignments);
      }
    } catch (e) {
      console.error('[BreakoutTab] Manual assign error:', e);
    }
  };

  // Broadcast toggle handler
  const handleToggleBroadcast = () => {
    if (!socket || !roomName) return;
    const enable = !isBroadcasting;
    socket.emit('toggle-broadcast', { sessionId: roomName, enable }, (res: any) => {
      if (res?.status === 'ok') setIsBroadcasting(res.isBroadcasting);
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with monitoring controls */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Breakout Rooms</p>
          <div className="flex items-center gap-2">
            {/* Peek Visibility toggle */}
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
            {/* Notify toggle */}
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
              {isBroadcasting ? 'Stop Broadcast' : 'Broadcast Audio'}
            </button>
          </div>
        </div>
        {/* Active monitoring indicator */}
        {isMonitoring && monitorTarget && (
          <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-500/20 rounded-md px-2.5 py-1">
            <span className="text-[10px] text-yellow-400">
              {peekMode ? '\ud83d\udc7b' : '\ud83d\udc41'} Monitoring {monitorTarget} ({peekMode ? 'invisible' : 'visible'})
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
      </div>

      {/* Teacher controls: room count + shuffle + manual */}
      {isTeacher && (
        <div className="px-3 pt-2 pb-1 space-y-2">
          {/* Room count selector + hint */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 whitespace-nowrap">Rooms:</label>
            <select
              data-testid="breakout-room-count"
              value={roomCount}
              onChange={(e) => setRoomCount(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-engagio-500"
            >
              {Array.from({ length: maxRooms - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {students.length > 0 && (
              <span data-testid="room-capacity-hint" className="text-[10px] text-gray-500">
                {capacityHint}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleShuffle}
              disabled={loading || students.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-engagio-600/20 hover:bg-engagio-600/30 disabled:opacity-50 border border-engagio-500/30 text-engagio-400 text-xs font-medium transition-colors"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              Auto Shuffle
            </button>
            <button
              onClick={() => setIsManualMode((m) => !m)}
              disabled={loading || students.length === 0}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isManualMode
                  ? 'bg-engagio-600/30 text-engagio-300 border-engagio-500/40'
                  : 'bg-gray-700/30 text-gray-300 border-gray-600/30 hover:bg-gray-700/50'
              } disabled:opacity-50`}
            >
              <UserPlus className="w-4 h-4" />
              Manual Allocation
            </button>
          </div>
        </div>
      )}

      {/* Room cards with health badges */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-2">
        {Object.keys(groups).length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">No students yet</p>
        )}

        {/* Unassigned pool (visible in manual mode) */}
        {isTeacher && isManualMode && unassignedStudents.length > 0 && (
          <div data-testid="unassigned-pool" className="border border-dashed border-gray-600 rounded-lg bg-gray-800/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-300">Unassigned</span>
                <span data-testid="room-student-count" className="text-[10px] text-gray-500">{unassignedStudents.length} student{unassignedStudents.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {unassignedStudents.map((student) => (
                <div key={student.identity} className="flex items-center gap-2">
                  <div className="flex-1">
                    <StudentAvatar participant={student} scores={engagementScores} />
                  </div>
                  {/* Assign buttons to each existing room (excluding main) */}
                  <div className="flex items-center gap-1">
                    {Object.keys(groups)
                      .filter((roomId) => roomId !== 'main')
                      .map((roomId, idx) => (
                        <button
                          key={roomId}
                          data-testid={`assign-to-room-${idx}`}
                          onClick={() => handleAssignStudent(student.identity, roomId)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-engagio-600/20 text-engagio-400 hover:bg-engagio-600/30 border border-engagio-500/20 transition-colors"
                        >
                          {roomId}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.entries(groups).map(([roomId, members]) => {
          if (roomId === 'main') return null; // Skip main room in breakout view
          const health = roomHealth[roomId] || { avg: 0, count: members.length, status: 'red' as const };
          return (
            <div
              key={roomId}
              data-testid="breakout-room-card"
              className="border border-gray-700/50 rounded-lg bg-gray-800/30"
            >
              {/* Room header with health + monitor button */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700/30">
                <div className="flex items-center gap-2">
                  <HealthDot status={health.status} />
                  <span className="text-sm font-medium text-white">{roomId}</span>
                  <span data-testid="room-student-count" className="text-[10px] text-gray-500">{members.length} student{members.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isTeacher && !isMonitoring && (
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
              {/* Members list with speaking indicators */}
              <div className="p-2 space-y-1.5">
                {members.map((m) => (
                  <StudentAvatar
                    key={m.identity}
                    participant={m}
                    scores={engagementScores}
                    actions={
                      isTeacher && isManualMode ? (
                        <button
                          onClick={() => handleAssignStudent(m.identity, 'main')}
                          className="text-[10px] text-gray-400 hover:text-red-400 transition-colors px-1"
                          title="Move to unassigned"
                          aria-label="Move to unassigned"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-gray-800 space-y-2">
        {isTeacher && !isManualMode && (
          <button
            onClick={handleCloseAllRooms}
            disabled={loading || Object.keys(assignments).length === 0}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 border border-red-500/30 text-red-400 text-xs font-medium transition-colors"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Close All Rooms
          </button>
        )}
        {isTeacher && isManualMode && (
          <button
            onClick={() => setIsManualMode(false)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/30 text-gray-300 text-xs font-medium transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
