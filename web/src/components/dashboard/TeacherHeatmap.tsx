/** @file TeacherHeatmap.tsx
 * Priority-queue heatmap with:
 *  – Sort: hand-raised first, then lowest-score-first
 *  – Visual: amber glow ring on raised hands
 *  – Action: Zap (Nudge) button + Moderation Menu per card
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import {
  Zap, MoreVertical, Mic, VideoOff, Hand, LogOut, Shield, Layers,
} from 'lucide-react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth-context';

/* ── shared types ── */
export interface LiveScore {
  userId: string;
  email: string;
  score: number;
  color: 'green' | 'yellow' | 'red';
  isHandRaised?: boolean;
  handRaisedAt?: string;
  breakoutRoomId?: string | null;
}

function getScoreClasses(score: number) {
  if (score > 70) {
    return { bg:'bg-engagio-success/15', border:'border-engagio-success/40',  text:'text-engagio-success', bar:'bg-engagio-success', label:'bg-engagio-success' };
  }
  if (score >= 40) {
    return { bg:'bg-engagio-warning/15', border:'border-engagio-warning/40',  text:'text-engagio-warning', bar:'bg-engagio-warning', label:'bg-engagio-warning' };
  }
  return { bg:'bg-engagio-danger/15',  border:'border-engagio-danger/40',   text:'text-engagio-danger',  bar:'bg-engagio-danger',  label:'bg-engagio-danger' };
}

/* ── hook: poll live-scores ── */
export function useLiveScores(sessionId: string, intervalMs = 10_000) {
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tick = useCallback(async () => {
    try {
      const res = await api.get(`/analytics/session/${sessionId}/live-scores`);
      setScores(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 401) setError('Session expired. Please log in again.');
      else setError('Failed to load live scores');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [sessionId, tick, intervalMs]);

  return { scores, loading, error, refetch: tick };
}

/* ── priority sort ── */
function sortLiveScores(scores: LiveScore[]): LiveScore[] {
  return [...scores].sort((a, b) => {
    const aRaised = !!a.isHandRaised;
    const bRaised = !!b.isHandRaised;
    if (aRaised !== bRaised) return aRaised ? -1 : 1;
    if (aRaised && bRaised) {
      const ta = a.handRaisedAt ? new Date(a.handRaisedAt).getTime() : Infinity;
      const tb = b.handRaisedAt ? new Date(b.handRaisedAt).getTime() : Infinity;
      return ta - tb;
    }
    return a.score - b.score;
  });
}

/* ─── Moderation Menu ─── */
function ModerationMenu({
  userId,
  email,
  handRaised,
  onCommand,
}: {
  userId: string;
  email: string;
  handRaised: boolean;
  onCommand: (userId: string, action: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /* Dropdown closes only via trigger button or Escape key.
     Previously a document.click handler raced with React re-renders
     and closed the menu before Playwright could click confirmation. */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const items = [
    { action: 'MUTE_MIC', label: 'Mute Microphone', icon: Mic, color: 'text-gray-200' },
    { action: 'DISABLE_CAM', label: 'Disable Camera', icon: VideoOff, color: 'text-gray-200' },
    ...(handRaised ? [{ action: 'LOWER_HAND', label: 'Lower Hand', icon: Hand, color: 'text-yellow-400' }] : []),
    { action: 'TRANSFER_HOST', label: 'Transfer Host', icon: Shield, color: 'text-engagio-400' },
    { action: 'KICK', label: 'Kick Student', icon: LogOut, color: 'text-red-400', danger: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        data-testid={`moderation-btn-${userId}`}
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg hover:bg-gray-700/60 text-gray-400 hover:text-white transition-colors"
        title="Moderation"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-20 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl min-w-[200px] overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-engagio-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Moderate</span>
          </div>
            {items.map(({ action, label, icon: Icon, color, danger }) => (
            <button
              key={action}
              data-testid={`mod-${action.toLowerCase().replace(/_/g, '-')}-${userId}`}
              onClick={(e) => {
                e.stopPropagation();
                onCommand(userId, action);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                danger ? 'text-red-400 hover:bg-red-500/10' : `hover:bg-gray-800 ${color}`
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Individual Card ─── */
function ParticipantCard({
  s,
  onNudge,
  onCommand,
}: {
  s: LiveScore;
  onNudge: (userId: string) => void;
  onCommand: (userId: string, action: string) => void;
}) {
  const cls = getScoreClasses(s.score);
  const handRaised = !!s.isHandRaised;

  const borderClasses = handRaised
    ? 'bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
    : `${cls.bg} ${cls.border}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      data-testid={`participant-card-${s.userId}`}
      data-score={s.score}
      className={`relative rounded-2xl border p-5 flex flex-col gap-3 overflow-hidden ${borderClasses}`}
    >
      {/* Glow bar at top */}
      <motion.div
        layout
        className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${cls.bar}`}
        transition={{ duration: 0.5 }}
      />

      {/* Score label pill + Moderation Menu */}
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-black ${cls.label}`}>
          {s.score}/100
        </div>
        <div className="flex items-center gap-1">
          <ModerationMenu
            userId={s.userId}
            email={s.email}
            handRaised={handRaised}
            onCommand={onCommand}
          />
          <svg className={`w-5 h-5 ${cls.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            {s.score > 70 && <path d="M14.7 9.3a2.41 2.41 0 0 0-3.4 0 2.41 2.41 0 0 0 0 3.4 2.41 2.41 0 0 0 3.4 0 2.41 2.41 0 0 0 0-3.4z"/>}
            {s.score < 40 && <path d="M12 8v5"/>}
            <circle cx="12" cy="17" r="1" />
          </svg>
        </div>
      </div>

      {/* Name */}
      <p className="text-sm font-semibold text-gray-200 truncate">{s.email}</p>

      {/* Progress bar */}
      <div className="h-2 bg-gray-800/70 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${cls.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${s.score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>

      {/* Zap / Nudge */}
      <button
        data-testid={`nudge-btn-${s.userId}`}
        onClick={() => onNudge(s.userId)}
        className="mt-auto flex items-center justify-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/10 transition-colors"
        title={`Nudge ${s.email}`}
      >
        <Zap className="w-3.5 h-3.5" />
        Nudge
      </button>
    </motion.div>
  );
}

/* ─── TeacherHeatmap Grid ─── */
export interface TeacherHeatmapProps {
  sessionId: string;
}

export default function TeacherHeatmap({ sessionId }: TeacherHeatmapProps) {
  const { userId, tenantId: authTenantId } = useAuth();
  const tenantId = authTenantId || '';
  const { scores, loading, error, refetch } = useLiveScores(sessionId);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    if (!sessionId || !userId) return;  // wait for auth to load
    const sk = getSocket();
    if (!sk.connected) sk.connect();
    sk.emit('joinClassroom', {
      sessionId,
      userId,
      tenantId,
      courseId: sessionId,
    });
    socketRef.current = sk;
  }, [sessionId, userId, tenantId]);

  const handleNudge = useCallback((targetUserId: string) => {
    const sk = socketRef.current;
    if (!sk) return;
    sk.emit('send-nudge', { sessionId, targetUserId });
  }, [sessionId]);

  const handleCommand = useCallback((targetUserId: string, action: string) => {
    const sk = socketRef.current;
    if (!sk) { console.error(`[handleCommand] no socket, action=${action}`); return; }
    console.log(`[handleCommand] emitting room-command session=${sessionId} target=${targetUserId} action=${action} connected=${sk.connected} id=${sk.id}`);
    sk.emit('room-command', { sessionId, targetUserId, action });
    // Optimistic refetch for near-instant UI feedback
    setTimeout(() => refetch(), 500);
  }, [sessionId, refetch]);

  const sortedScores = sortLiveScores(scores);

  /* Stats */
  const engagedCount = sortedScores.filter((s) => s.score > 70).length;
  const neutralCount = sortedScores.filter((s) => s.score >= 40 && s.score <= 70).length;
  const atRiskCount  = sortedScores.filter((s) => s.score < 40).length;
  const avgScore     = sortedScores.length ? Math.round(sortedScores.reduce((a, b) => a + b.score, 0) / sortedScores.length) : 0;

  /* Group by breakout room */
  const grouped = React.useMemo(() => {
    const g: Record<string, LiveScore[]> = {};
    for (const s of sortedScores) {
      const room = s.breakoutRoomId || 'Main Room';
      if (!g[room]) g[room] = [];
      g[room].push(s);
    }
    // Sort: Main Room first, then alphabetical
    return Object.entries(g).sort(([a], [b]) => {
      if (a === 'Main Room') return -1;
      if (b === 'Main Room') return 1;
      return a.localeCompare(b);
    });
  }, [sortedScores]);

  return (
    <div data-testid="teacher-heatmap" className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Tracked', value: sortedScores.length, color: 'text-gray-100' },
          { label: 'Engaged (>70)', value: engagedCount, color: 'text-engagio-success' },
          { label: 'Neutral', value: neutralCount, color: 'text-engagio-warning' },
          { label: 'At Risk (<40)', value: atRiskCount, color: 'text-engagio-danger' },
          { label: 'Average', value: avgScore, color: 'text-gray-100' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-center"
          >
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading && sortedScores.length === 0 && (
        <div className="text-gray-500 text-center py-12 text-sm animate-pulse">Loading live scores…</div>
      )}

      <LayoutGroup>
        {grouped.map(([roomName, roomScores]) => (
          <div key={roomName} className="space-y-3">
            <div className="flex items-center gap-2 mt-6 first:mt-0">
              <Layers className="w-4 h-4 text-engagio-400" />
              <span className="text-sm font-semibold text-engagio-400 uppercase tracking-wider">
                {roomName}
              </span>
              <span className="text-xs text-gray-500">({roomScores.length})</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              {roomScores.map((s) => (
                <ParticipantCard
                  key={s.userId}
                  s={s}
                  onNudge={handleNudge}
                  onCommand={handleCommand}
                />
              ))}
            </motion.div>
          </div>
        ))}
      </LayoutGroup>

      {!loading && sortedScores.length === 0 && !error && (
        <div className="text-center text-gray-500 py-12 text-sm">No participants in this session yet.</div>
      )}
    </div>
  );
}
