'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { BrainCircuit, Trophy } from 'lucide-react';
import QuizCreatorForm, { type QuizFormData } from './QuizCreatorForm';
import QuizHostControl from './QuizHostControl';
import LeaderboardDisplay from './LeaderboardDisplay';
import type { LeaderboardEntry } from '@/types/quiz';

interface QuizPanelProps {
  sessionId: string;
  socket: any;
  isTeacher: boolean;
}

export default function QuizPanel({ sessionId, socket, isTeacher }: QuizPanelProps) {
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'active' | 'completed'>('idle');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeLeaderboardId, setActiveLeaderboardId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '';

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('engagio_token') || '' : '';

  /* ── Listen for quiz socket events (teacher side) ── */
  useEffect(() => {
    if (!socket || !isTeacher) return;

    const onQuestion = (data: { quizSessionId: string; questionIndex: number }) => {
      setCurrentQuestionIndex(data.questionIndex);
      setStatus('active');
    };
    const onEnd = (data: { quizSessionId: string }) => {
      if (data.quizSessionId === quizSessionId) {
        setStatus('completed');
        setCurrentQuestionIndex(totalQuestions);
      }
    };
    const onLeaderboard = (data: { quizSessionId: string; leaderboard: LeaderboardEntry[] }) => {
      if (data.quizSessionId === quizSessionId) {
        setLeaderboard(data.leaderboard);
        setActiveLeaderboardId(quizSessionId);
        setShowLeaderboard(true);
      }
    };

    socket.on('quiz:question', onQuestion);
    socket.on('quiz:end', onEnd);
    socket.on('quiz:leaderboard', onLeaderboard);

    return () => {
      socket.off('quiz:question', onQuestion);
      socket.off('quiz:end', onEnd);
      socket.off('quiz:leaderboard', onLeaderboard);
    };
  }, [socket, isTeacher, quizSessionId, totalQuestions]);

  const handleCreateQuiz = useCallback(
    async (questions: QuizFormData['questions']) => {
      setError(null);
      setCreating(true);
      try {
        const res = await fetch(`${API}/sessions/${encodeURIComponent(sessionId)}/quizzes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ questions }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        const newQuizSessionId = data.id;
        setQuizSessionId(newQuizSessionId);
        setTotalQuestions(questions.length);
        setShowLeaderboard(false);

        // ── AUTO-START: immediately broadcast to all participants ──
        if (socket && newQuizSessionId) {
          socket.emit('quiz-start', { quizSessionId: newQuizSessionId, sessionId });
          setStatus('active');
          setCurrentQuestionIndex(0);
        } else {
          setStatus('pending');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to create quiz');
      } finally {
        setCreating(false);
      }
    },
    [API, sessionId, socket]
  );

  const handleStartQuiz = useCallback(() => {
    if (!socket || !quizSessionId) return;
    socket.emit('quiz-start', { quizSessionId, sessionId });
    setStatus('active');
    setCurrentQuestionIndex(0);
    setShowLeaderboard(false);
  }, [socket, quizSessionId, sessionId]);

  const handleNextQuestion = useCallback(() => {
    if (!socket || !quizSessionId) return;
    socket.emit('quiz-next', { quizSessionId, sessionId });
    setCurrentQuestionIndex((prev) => prev + 1);
  }, [socket, quizSessionId, sessionId]);

  const handleShowLeaderboard = useCallback(async () => {
    if (!quizSessionId) return;
    try {
      const res = await fetch(
        `${API}/sessions/${encodeURIComponent(sessionId)}/quizzes/${encodeURIComponent(quizSessionId)}/leaderboard`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      setLeaderboard(data);
      setActiveLeaderboardId(quizSessionId);
      setShowLeaderboard(true);
    } catch {
      // ignore
    }
  }, [API, sessionId, quizSessionId]);

  if (!isTeacher) {
    // Students see a read-only placeholder in the quiz tab (the actual QuizOverlay is a portal overlay)
    if (showLeaderboard && activeLeaderboardId === quizSessionId) {
      return <LeaderboardDisplay entries={leaderboard} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <BrainCircuit className="w-12 h-12 text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">Quizzes appear here when your teacher starts one.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {status !== 'idle' ? (
        <>
          <QuizHostControl
            quizSessionId={quizSessionId}
            status={status}
            currentQuestionIndex={currentQuestionIndex}
            totalQuestions={totalQuestions}
            onStart={handleStartQuiz}
            onNext={handleNextQuestion}
            onShowLeaderboard={handleShowLeaderboard}
          />
          {showLeaderboard && (
            <div className="flex-1 overflow-y-auto px-2 pt-2">
              <LeaderboardDisplay entries={leaderboard} />
            </div>
          )}
        </>
      ) : (
        <QuizCreatorForm sessionId={sessionId} onCreateQuiz={handleCreateQuiz} />
      )}
      {error && (
        <p className="px-4 py-2 text-xs text-red-400 bg-red-900/10 border-t border-red-500/20">{error}</p>
      )}
    </div>
  );
}
