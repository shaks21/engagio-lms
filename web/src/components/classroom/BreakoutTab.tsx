'use client';

import React, { useState } from 'react';
import { LogOut, Shuffle, UserPlus, Users, Layers } from 'lucide-react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { useAuth } from '@/lib/auth-context';

interface BreakoutTabProps {
  roomName: string;
  onAssignmentsChange?: (assignments: Record<string, string>) => void;
}

export default function BreakoutTab({
  roomName,
  onAssignmentsChange,
}: BreakoutTabProps) {
  const livekitParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  // Build participant list from LiveKit state
  const participants = React.useMemo(() => {
    const all = [];
    if (localParticipant) {
      all.push({
        identity: localParticipant.identity,
        name: localParticipant.name || localParticipant.identity,
        isLocal: true,
        isTeacher,
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
        isTeacher: false, // remote — actual role not in LiveKit participant
        breakoutRoomId: (() => {
          try { return JSON.parse(p.metadata || '{}').breakoutRoomId || null; }
          catch { return null; }
        })(),
      });
    });
    return all;
  }, [livekitParticipants, localParticipant, isTeacher]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roomNameInput, setRoomNameInput] = useState('');
  const [groupCount, setGroupCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const students = participants.filter((p: any) => !p.isTeacher);

  // Fetch current assignments on mount
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

  // Group by room
  const groups = React.useMemo(() => {
    const g: Record<string, any[]> = {};
    students.forEach((s) => {
      const roomId = s.breakoutRoomId || 'main';
      if (!g[roomId]) g[roomId] = [];
      g[roomId].push(s);
    });
    return g;
  }, [students]);

  const handleToggleSelect = (identity: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(identity)) next.delete(identity);
      else next.add(identity);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!roomNameInput.trim() || selected.size === 0) return;
    setLoading(true);
    const payload: Record<string, string> = {};
    selected.forEach((id) => { payload[id] = roomNameInput.trim(); });

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('engagio_token') || ''}`,
          },
          body: JSON.stringify({ assignments: payload }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSelected(new Set());
        setRoomNameInput('');
        setAssignments(Object.assign({}, assignments, data.assignments));
        onAssignmentsChange?.(Object.assign({}, assignments, data.assignments));
      }
    } finally { setLoading(false); }
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts/clear`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('engagio_token') || ''}`,
          },
        }
      );
      setAssignments({});
      onAssignmentsChange?.({});
    } finally { setLoading(false); }
  };

  const handleAutoShuffle = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts/auto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('engagio_token') || ''}`,
          },
          body: JSON.stringify({ groupCount }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments);
        onAssignmentsChange?.(data.assignments);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-800 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Breakout Rooms</p>

        {/* Room name input + assign */}
        <div className="flex gap-2">
          <input
            type="text"
            value={roomNameInput}
            onChange={(e) => setRoomNameInput(e.target.value)}
            placeholder="Room name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-engagio-500"
          />
          <button
            onClick={handleAssign}
            disabled={!roomNameInput.trim() || selected.size === 0 || loading}
            className="bg-engagio-600 hover:bg-engagio-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-white text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Selected count */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Users className="w-3.5 h-3.5" />
          {selected.size} selected
        </div>
      </div>

      {/* Participant list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {students.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">No students yet</p>
        )}
        {students.map((s) => (
          <button
            key={s.identity}
            onClick={() => handleToggleSelect(s.identity)}
            className={`w-full flex items-center gap-3 px-3 py-2 border-b border-gray-800/50 text-left transition-colors ${
              selected.has(s.identity) ? 'bg-engagio-900/30' : 'hover:bg-gray-800/50'
            }`}
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                selected.has(s.identity)
                  ? 'bg-engagio-500 border-engagio-500'
                  : 'border-gray-600'
              }`}
            >
              {selected.has(s.identity) && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-200 truncate">{s.name}</span>
            {s.breakoutRoomId && (
              <span className="ml-auto bg-engagio-500/20 text-engagio-400 px-2 py-0.5 rounded text-[10px]">
                {s.breakoutRoomId}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-gray-800 space-y-2">
        {/* Auto-shuffle */}
        <div className="flex gap-2">
          <input
            type="number"
            min={2}
            max={10}
            value={groupCount}
            onChange={(e) => setGroupCount(Number(e.target.value))}
            className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-engagio-500"
          />
          <button
            onClick={handleAutoShuffle}
            disabled={loading}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Shuffle className="w-4 h-4" />
            Auto-Shuffle
          </button>
        </div>

        <button
          onClick={handleClearAll}
          disabled={loading}
          className="w-full bg-red-600/20 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 rounded-lg px-3 py-1.5 text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          Close All Rooms
        </button>
      </div>
    </div>
  );
}
