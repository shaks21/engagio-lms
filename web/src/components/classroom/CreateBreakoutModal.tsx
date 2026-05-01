'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { X, Minus, Plus, Bot, Hand, Users, Check, Loader, LogIn } from 'lucide-react';

/* ─── types ─── */
interface Student {
  identity: string;
  name: string;
}

type AllocationMode = 'AUTO' | 'MANUAL' | 'SELF_SELECT';

const MAX_ROOMS = 25;

interface CreateBreakoutModalProps {
  roomName: string;
  students: Student[];
  hostIdentity?: string;
  currentRoomCount: number;
  existingAssignments?: Record<string, string>;
  onClose: () => void;
  onCreated: (assignments: Record<string, string>, groupCount: number, mode: AllocationMode) => void;
}

/* ─── Room allocation label helper ─── */
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

/* ─── Auto-shuffle helper ─── */
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateAutoAssignments(
  students: Student[],
  roomCount: number,
  hostIdentity?: string,
): Record<string, string> {
  const assignments: Record<string, string> = {};
  const shuffled = shuffleArray(students);
  shuffled.forEach((s, idx) => {
    const roomIdx = idx % roomCount;
    assignments[s.identity] = `room-${String.fromCharCode(97 + roomIdx)}`;
  });
  // Host stays in main room
  if (hostIdentity) {
    assignments[hostIdentity] = 'main';
  }
  return assignments;
}

/* ─── Allocation mode card ─── */
function ModeCard({
  id,
  title,
  description,
  icon: Icon,
  selected,
  onClick,
}: {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={`mode-${id}`}
      onClick={onClick}
      className={`flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all duration-200 ${
        selected
          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
          selected ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'
        }`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <span className={`text-sm font-semibold mb-1 ${selected ? 'text-white' : 'text-gray-300'}`}>
        {title}
      </span>
      <span className="text-xs text-gray-500 leading-relaxed">{description}</span>
    </button>
  );
}

/* ─── Self-select room card ─── */
function SelfSelectRoomCard({
  roomId,
  studentCount,
}: {
  roomId: string;
  studentCount: number;
}) {
  return (
    <div
      data-testid="self-select-room-card"
      className="flex flex-col items-center text-center p-4 rounded-xl border border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 mb-2">
        {roomId.split('-')[1]?.toUpperCase() ?? roomId}
      </div>
      <span className="text-sm font-semibold text-white mb-1">{roomId}</span>
      <span className="text-xs text-gray-500">{studentCount} of 0 student{studentCount !== 1 ? 's' : ''}</span>
    </div>
  );
}

/* ─── Student chip ─── */
function StudentChip({
  student,
  onAssign,
  roomId,
  showAssign = true,
}: {
  student: Student;
  onAssign?: (identity: string, roomId: string) => void;
  roomId?: string;
  showAssign?: boolean;
}) {
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-2.5 py-1.5 border border-gray-700/50">
      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300">
        {initials}
      </div>
      <span className="text-xs text-gray-300 truncate max-w-[6rem]">{student.name}</span>
      {showAssign && onAssign && roomId && (
        <button
          data-testid={`manual-assign-btn-${student.identity}`}
          onClick={() => onAssign(student.identity, roomId)}
          className="ml-1 text-engagio-400 hover:text-engagio-300 transition-colors"
          title="Assign to room"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ─── Main component ─── */
export default function CreateBreakoutModal({
  roomName,
  students,
  hostIdentity,
  currentRoomCount,
  existingAssignments,
  onClose,
  onCreated,
}: CreateBreakoutModalProps) {
  const [roomCount, setRoomCount] = useState(currentRoomCount);
  const [mode, setMode] = useState<AllocationMode>('AUTO');
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>(() => {
    // Pre-seed manualAssignments from existing assignments so reconfiguration works
    if (!existingAssignments) return {};
    const seeded: Record<string, string> = {};
    for (const [identity, roomId] of Object.entries(existingAssignments)) {
      if (roomId && roomId !== 'main') seeded[identity] = roomId;
    }
    return seeded;
  });
  const [loading, setLoading] = useState(false);

  const studentCount = students.length;

  /* derived manual state */
  const unassignedStudents = useMemo(() => {
    return students.filter((s) => {
      const assigned = manualAssignments[s.identity];
      return !assigned || assigned === 'main';
    });
  }, [students, manualAssignments]);

  const roomMembers = useMemo(() => {
    const g: Record<string, Student[]> = {};
    for (let i = 0; i < roomCount; i++) {
      g[`room-${String.fromCharCode(97 + i)}`] = [];
    }
    students.forEach((s) => {
      const roomId = manualAssignments[s.identity];
      if (roomId && roomId !== 'main' && g[roomId]) {
        g[roomId].push(s);
      }
    });
    return g;
  }, [students, manualAssignments, roomCount]);

  const moveStudent = useCallback((identity: string, roomId: string | null) => {
    setManualAssignments((prev) => {
      const next = { ...prev };
      if (roomId === null || roomId === 'main') {
        delete next[identity];
      } else {
        next[identity] = roomId;
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('engagio_token');

      let assignments: Record<string, string> = {};

      if (mode === 'AUTO') {
        assignments = generateAutoAssignments(students, roomCount, hostIdentity);
      } else if (mode === 'MANUAL') {
        // Merge manual changes on top of existing assignments; only replace entries we touched
        assignments = { ...existingAssignments, ...manualAssignments };
        // Ensure host stays in main
        if (hostIdentity) {
          assignments[hostIdentity] = 'main';
        }
      } else if (mode === 'SELF_SELECT') {
        // Preserve existing assignments but switch mode to self-select so students can opt-in
        assignments = { ...existingAssignments };
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/sessions/${roomName}/breakouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ assignments, groupCount: roomCount, assignmentMode: mode, grantPermissions: true }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Failed to create rooms: ${res.status} ${body}`);
      }

      onCreated(assignments, roomCount, mode);
    } catch (e: any) {
      console.error('[CreateBreakoutModal] Error:', e);
      // Still call onCreated so UI updates
      let fallbackAssignments: Record<string, string> = {};
      if (mode === 'AUTO') {
        fallbackAssignments = generateAutoAssignments(students, roomCount, hostIdentity);
      } else if (mode === 'MANUAL') {
        fallbackAssignments = { ...existingAssignments, ...manualAssignments };
        if (hostIdentity) fallbackAssignments[hostIdentity] = 'main';
      } else if (mode === 'SELF_SELECT') {
        fallbackAssignments = { ...existingAssignments };
      }
      onCreated(fallbackAssignments, roomCount, mode);
    } finally {
      setLoading(false);
    }
  }, [roomName, students, roomCount, mode, manualAssignments, hostIdentity, existingAssignments, onCreated]);

  return (
    <div
      data-testid="create-breakout-modal"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#1a1a24] border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Create Breakout Rooms</h2>
          <button
            data-testid="modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Room count stepper */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Number of rooms:</span>
            <div className="flex items-center gap-3 bg-gray-800 rounded-full px-4 py-2 border border-gray-700">
              <button
                data-testid="room-count-minus"
                onClick={() => setRoomCount((c) => Math.max(1, c - 1))}
                disabled={roomCount <= 1}
                className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span data-testid="room-count-value" className="text-sm font-semibold text-white w-6 text-center">
                {roomCount}
              </span>
              <button
                data-testid="room-count-plus"
                onClick={() => setRoomCount((c) => Math.min(MAX_ROOMS, c + 1))}
                disabled={roomCount >= MAX_ROOMS}
                className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Allocation summary */}
          <div data-testid="allocation-summary" className="text-xs text-gray-500">
            {getRoomAllocationLabel(roomCount, studentCount)}
          </div>

          {/* Mode selector cards */}
          <div className="grid grid-cols-3 gap-3">
            <ModeCard
              id="auto"
              title="Assign Automatically"
              description="System randomly assigns students to rooms."
              icon={Bot}
              selected={mode === 'AUTO'}
              onClick={() => setMode('AUTO')}
            />
            <ModeCard
              id="manual"
              title="Assign Manually"
              description="Drag and drop students into specific rooms."
              icon={Hand}
              selected={mode === 'MANUAL'}
              onClick={() => setMode('MANUAL')}
            />
            <ModeCard
              id="self-select"
              title="Let Students Choose"
              description="Students select their own rooms."
              icon={Users}
              selected={mode === 'SELF_SELECT'}
              onClick={() => setMode('SELF_SELECT')}
            />
          </div>

          {/* Manual allocation panel */}
          {mode === 'MANUAL' && (
            <div className="space-y-3">
              {/* Unassigned pool */}
              <div
                data-testid="manual-unassigned-pool"
                className="border border-dashed border-gray-600 rounded-lg bg-gray-800/20 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-300">Unassigned</span>
                  <span className="text-[10px] text-gray-500">
                    {unassignedStudents.length} student{unassignedStudents.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {unassignedStudents.length === 0 ? (
                  <p className="text-[10px] text-gray-500 text-center py-2">All students assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {unassignedStudents.map((s) => (
                      <StudentChip key={s.identity} student={s} />
                    ))}
                  </div>
                )}
              </div>

              {/* Room columns */}
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: roomCount }, (_, i) => `room-${String.fromCharCode(97 + i)}`).map((roomId) => (
                  <div
                    key={roomId}
                    data-testid="manual-room-column"
                    className="border border-gray-700/50 rounded-lg bg-gray-800/30 p-2.5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white">{roomId}</span>
                      <span className="text-[10px] text-gray-500">
                        {(roomMembers[roomId] || []).length} student
                        {(roomMembers[roomId] || []).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
                      {(roomMembers[roomId] || []).map((s) => (
                        <div key={s.identity} className="flex items-center gap-1 bg-gray-700/50 rounded px-1.5 py-0.5">
                          <span className="text-[10px] text-gray-300">{s.name}</span>
                          <button
                            onClick={() => moveStudent(s.identity, null)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {unassignedStudents.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {unassignedStudents.map((s) => (
                          <button
                            key={s.identity}
                            data-testid={`manual-assign-btn-${s.identity}`}
                            onClick={() => moveStudent(s.identity, roomId)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-engagio-600/20 text-engagio-400 hover:bg-engagio-600/40 transition-colors"
                          >
                            + {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Self-select panel */}
          {mode === 'SELF_SELECT' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Students will see these rooms and can pick one to join.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: roomCount }, (_, i) => `room-${String.fromCharCode(97 + i)}`).map((roomId) => (
                  <SelfSelectRoomCard
                    key={roomId}
                    roomId={roomId}
                    studentCount={0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="modal-create-btn"
            onClick={handleCreate}
            disabled={loading || (mode === 'MANUAL' && unassignedStudents.length > 0 && studentCount > 0)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              loading || (mode === 'MANUAL' && unassignedStudents.length > 0 && studentCount > 0)
                ? 'bg-red-500/40 text-red-200 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
            }`}
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            <Check className="w-4 h-4" />
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
