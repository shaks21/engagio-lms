'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';

export type EngagementState = 'green' | 'yellow' | 'red';

export interface EngagementScore {
  userId: string;
  email: string;
  score: number;
  color: string;
}

export interface ClassPulseEntry {
  time: string;
  score: number;
}

export interface SessionScoreHistory {
  session: { id: string };
  classPulse: ClassPulseEntry[];
  byUser: Record<string, { email: string; history: { time: string; score: number }[] }>;
}

export interface EngagementResult {
  state: EngagementState;
  score: number | null;
  avgScore: number;
  history: ClassPulseEntry[];
  scores: EngagementScore[];
  loading: boolean;
  error: string | null;
}

function getStateFromScore(score: number | null): EngagementState {
  if (score === null) return 'green';
  if (score < 30) return 'red';
  if (score < 70) return 'yellow';
  return 'green';
}

export function useEngagement(
  sessionId: string,
  participantIdentity?: string | null,
  isTeacher?: boolean
): EngagementResult {
  const [scores, setScores] = useState<EngagementScore[]>([]);
  const [history, setHistory] = useState<ClassPulseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchScores = useCallback(async () => {
    try {
      const { data } = await api.get<EngagementScore[]>(`/analytics/session/${sessionId}/live-scores`);
      setScores(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch engagement');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchHistory = useCallback(async () => {
    if (!isTeacher) return;
    try {
      const { data } = await api.get<SessionScoreHistory>(`/analytics/session/${sessionId}/history`);
      setHistory(data.classPulse || []);
    } catch {
      // silently fail for history
    }
  }, [sessionId, isTeacher]);

  useEffect(() => {
    if (!sessionId) return;
    fetchScores();
    fetchHistory();

    intervalRef.current = setInterval(() => {
      fetchScores();
      if (isTeacher) fetchHistory();
    }, 8000); // Poll every 8 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, fetchScores, fetchHistory, isTeacher]);

  const myEntry = participantIdentity
    ? scores.find((s) => s.userId === participantIdentity)
    : null;

  const score = myEntry?.score ?? null;
  const state = getStateFromScore(score);
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length)
      : 0;

  return { state, score, avgScore, history, scores, loading, error };
}
