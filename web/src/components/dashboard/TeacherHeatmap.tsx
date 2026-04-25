'use client';

import React, { useState, useEffect } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import api from '@/lib/api';

export interface LiveScore {
  userId: string;
  email: string;
  score: number;
  color: 'green' | 'yellow' | 'red';
}

/** Maps an engagement score to a Tailwind v4 bg / text class */
function getScoreClasses(score: number) {
  if (score > 70) {
    return {
      bg: 'bg-engagio-success/15',
      border: 'border-engagio-success/40',
      text: 'text-engagio-success',
      bar: 'bg-engagio-success',
      label: 'bg-engagio-success',
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-engagio-warning/15',
      border: 'border-engagio-warning/40',
      text: 'text-engagio-warning',
      bar: 'bg-engagio-warning',
      label: 'bg-engagio-warning',
    };
  }
  return {
    bg: 'bg-engagio-danger/15',
    border: 'border-engagio-danger/40',
    text: 'text-engagio-danger',
    bar: 'bg-engagio-danger',
    label: 'bg-engagio-danger',
  };
}

/**
 * Hook that polls the live-scores endpoint every `intervalMs`.
 */
export function useLiveScores(sessionId: string, intervalMs = 10_000) {
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tick = async () => {
    try {
      const res = await api.get(`/analytics/session/${sessionId}/live-scores`);
      setScores(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError('Failed to load live scores');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [sessionId, intervalMs]);

  return { scores, loading, error, refetch: tick };
}

/* ─── Individual Card ─── */
function ParticipantCard({ s }: { s: LiveScore }) {
  const cls = getScoreClasses(s.score);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      data-testid={`participant-card-${s.userId}`}
      data-score={s.score}
      className={`relative rounded-2xl border p-5 flex flex-col gap-3 overflow-hidden ${cls.bg} ${cls.border}`}
    >
      {/* Glow bar at top */}
      <motion.div
        layout
        className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${cls.bar}`}
        transition={{ duration: 0.5 }}
      />

      {/* Score label pill */}
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-black ${cls.label}`}>
          {s.score}/100
        </div>
        <svg className={`w-5 h-5 ${cls.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          {s.score > 70 && <path d="M14.7 9.3a2.41 2.41 0 0 0-3.4 0 2.41 2.41 0 0 0 0 3.4 2.41 2.41 0 0 0 3.4 0 2.41 2.41 0 0 0 0-3.4z"/>}
          {s.score < 40 && <path d="M12 8v5"/>}
          <circle cx="12" cy="17" r="1" />
        </svg>
      </div>

      {/* Name */}
      <p className="text-sm font-semibold text-gray-200 truncate">{s.email}</p>

      {/* Animated progress bar */}
      <div className="h-2 bg-gray-800/70 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${cls.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${s.score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Heatmap Grid ─── */
export interface TeacherHeatmapProps {
  sessionId: string;
}

export default function TeacherHeatmap({ sessionId }: TeacherHeatmapProps) {
  const { scores, loading, error, refetch } = useLiveScores(sessionId);

  const engagedCount = scores.filter((s) => s.score > 70).length;
  const neutralCount = scores.filter((s) => s.score >= 40 && s.score <= 70).length;
  const atRiskCount = scores.filter((s) => s.score < 40).length;
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
    : 0;

  return (
    <div data-testid="teacher-heatmap" className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {
          [
            { label: 'Tracked', value: scores.length, color: 'text-gray-100' },
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
          ))
        }
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && scores.length === 0 && (
        <div className="text-gray-500 text-center py-12 text-sm animate-pulse">Loading live scores…</div>
      )}

      {/* Grid */}
      <LayoutGroup>
        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {scores.map((s) => (
            <ParticipantCard key={s.userId} s={s} />
          ))}
        </motion.div>
      </LayoutGroup>

      {!loading && scores.length === 0 && !error && (
        <div className="text-center text-gray-500 py-12 text-sm">No participants in this session yet.</div>
      )}
    </div>
  );
}
