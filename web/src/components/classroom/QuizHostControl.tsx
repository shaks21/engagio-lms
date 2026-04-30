'use client';

import React from 'react';
import { Play, ChevronRight, Trophy } from 'lucide-react';

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
  return (
    <div className="border-t border-gray-800 bg-gray-900/40 px-4 py-4 space-y-3">
      {status === 'idle' && (
        <p className="text-xs text-gray-500 text-center">Create a quiz above to begin.</p>
      )}

      {status === 'pending' && quizSessionId && (
        <button
          onClick={onStart}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          data-testid="start-quiz-btn"
        >
          <Play className="w-4 h-4" />
          Start Quiz ({totalQuestions} Qs)
        </button>
      )}

      {status === 'active' && quizSessionId && (
        <div className="space-y-2">
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
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 bg-engagio-600 hover:bg-engagio-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            data-testid="next-question-btn"
          >
            <ChevronRight className="w-4 h-4" />
            {currentQuestionIndex + 1 >= totalQuestions ? 'End Quiz' : 'Next Question'}
          </button>
        </div>
      )}

      {status === 'completed' && quizSessionId && (
        <div className="space-y-2">
          <button
            onClick={onShowLeaderboard}
            className="w-full flex items-center justify-center gap-2 bg-engagio-600 hover:bg-engagio-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            data-testid="show-leaderboard-btn"
          >
            <Trophy className="w-4 h-4" />
            Show Leaderboard
          </button>
          <p className="text-[11px] text-gray-500 text-center">Quiz completed · {totalQuestions} questions</p>
        </div>
      )}
    </div>
  );
}
