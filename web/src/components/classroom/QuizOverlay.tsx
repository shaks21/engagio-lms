'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Timer, CheckCircle, XCircle } from 'lucide-react';
import type { CurrentQuestion } from '@/types/quiz';

interface QuizOverlayProps {
  question: CurrentQuestion;
  questionIndex: number;
  timer: number;
  isDisabled: boolean;
  correctResult: boolean | null;
  onSubmitAnswer: (optionId: string) => void;
}

export default function QuizOverlay({
  question,
  questionIndex,
  timer,
  isDisabled,
  correctResult,
  onSubmitAnswer,
}: QuizOverlayProps) {
  const isUrgent = timer <= 5;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      data-testid="quiz-overlay"
    >
      <div className="w-full max-w-lg mx-4 bg-edu-slate/95 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60 bg-engagio-600/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-engagio-300">Quiz Question {questionIndex + 1}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-engagio-600/20 text-engagio-300'
          }`}>
            <Timer className="w-3.5 h-3.5" />
            {timer}s
          </div>
        </div>

        {/* Question */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-lg font-medium text-white leading-relaxed">{question.question}</p>
        </div>

        {/* Options */}
        <div className="px-6 pb-4 space-y-2">
          {question.options.map((opt) => {
            const selected = correctResult !== null; // any result means we've answered
            return (
              <button
                key={opt.id}
                disabled={isDisabled}
                onClick={() => onSubmitAnswer(opt.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                  isDisabled
                    ? 'opacity-60 cursor-not-allowed border-gray-700 bg-gray-800/40'
                    : 'border-gray-600 bg-gray-800/60 hover:border-engagio-500 hover:bg-engagio-900/20 text-white'
                }`}
                data-testid={`quiz-option-${opt.id}`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        <AnimateFeedback correctResult={correctResult} />
      </div>
    </motion.div>
  );
}

function AnimateFeedback({ correctResult }: { correctResult: boolean | null }) {
  if (correctResult === null) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`px-6 py-3 border-t flex items-center gap-2 text-sm font-semibold ${
        correctResult
          ? 'border-green-500/30 bg-green-900/10 text-green-400'
          : 'border-red-500/30 bg-red-900/10 text-red-400'
      }`}
    >
      {correctResult ? (
        <>
          <CheckCircle className="w-4 h-4" />
          Correct! Well done.
        </>
      ) : (
        <>
          <XCircle className="w-4 h-4" />
          Incorrect. Keep going!
        </>
      )}
    </motion.div>
  );
}
