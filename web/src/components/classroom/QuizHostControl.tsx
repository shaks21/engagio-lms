'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ChevronRight, Trophy, RotateCcw, Loader2 } from 'lucide-react';

interface QuizHostControlProps {
  quizSessionId: string | null;
  status: 'idle' | 'pending' | 'active' | 'completed';
  currentQuestionIndex: number;
  totalQuestions: number;
  onStart: () => void;
  onNext: () => void;
  onShowLeaderboard: () => void;
}

export default function QuizHostControl({
  quizSessionId,
  status,
  currentQuestionIndex,
  totalQuestions,
  onStart,
  onNext,
  onShowLeaderboard,
}: QuizHostControlProps) {
  const [loadingAction, setLoadingAction] = useState<'none' | 'start' | 'next' | 'leaderboard'>('none');

  const wrap = async (action: 'start' | 'next' | 'leaderboard', fn: () => void | Promise<void>) => {
    setLoadingAction(action);
    try {
      await fn();
    } finally {
      setLoadingAction('none');
    }
  };

  return (
    <div className="border-t border-gray-800 bg-gray-900/40 px-4 py-4 space-y-3">
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <p className="text-xs text-gray-500 text-center">Create a quiz above to begin.</p>
        )}

        {status === 'pending' && quizSessionId && (
          <motion.button
            key="start"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={() => wrap('start', onStart)}
            disabled={loadingAction === 'start'}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            data-testid="start-quiz-btn"
          >
            {loadingAction === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Quiz ({totalQuestions} Qs)
              </>
            )}
          </motion.button>
        )}

        {status === 'active' && quizSessionId && (
          <motion.div
            key="active-controls"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Question {currentQuestionIndex + 1} / {totalQuestions}</span>
              <span>{Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-engagio-500 rounded-full transition-all"
                style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>
            <button
              onClick={() => wrap('next', onNext)}
              disabled={loadingAction === 'next'}
              className="w-full flex items-center justify-center gap-2 bg-engagio-600 hover:bg-engagio-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              data-testid="next-question-btn"
            >
              {loadingAction === 'next' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  {currentQuestionIndex + 1 >= totalQuestions ? 'End Quiz' : 'Next Question'}
                </>
              )}
            </button>
          </motion.div>
        )}

        {status === 'completed' && quizSessionId && (
          <motion.div
            key="completed-controls"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            <button
              onClick={() => wrap('leaderboard', onShowLeaderboard)}
              disabled={loadingAction === 'leaderboard'}
              className="w-full flex items-center justify-center gap-2 bg-engagio-600 hover:bg-engagio-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              data-testid="show-leaderboard-btn"
            >
              <Trophy className="w-4 h-4" />
              Show Leaderboard
            </button>
            <p className="text-[11px] text-gray-500 text-center">Quiz completed · {totalQuestions} questions</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
