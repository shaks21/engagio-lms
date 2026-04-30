'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { QuizSocketState, CurrentQuestion, LeaderboardEntry, QuizAnswerResult } from '@/types/quiz';

const QUESTION_TIMER_SECONDS = 30;

export interface UseQuizSocketReturn {
  quizState: QuizSocketState;
  timer: number;
  hasSubmitted: boolean;
  isDisabled: boolean;
  correctResult: boolean | null;
  submitAnswer: (optionId: string) => void;
  currentQuestionIndex: number;
}

export function useQuizSocket(socket: Socket | null, userId: string): UseQuizSocketReturn {
  const [quizState, setQuizState] = useState<QuizSocketState>({ kind: 'idle' });
  const quizStateRef = useRef<QuizSocketState>({ kind: 'idle' });

  useEffect(() => {
    quizStateRef.current = quizState;
  }, [quizState]);

  const [timer, setTimer] = useState(QUESTION_TIMER_SECONDS);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [correctResult, setCorrectResult] = useState<boolean | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearQuestionTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startQuestionTimer = useCallback(() => {
    clearQuestionTimer();
    setTimer(QUESTION_TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearQuestionTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearQuestionTimer]);

  useEffect(() => {
    if (!socket) return;

    const onQuestion = (data: {
      quizSessionId: string;
      questionIndex: number;
      question: CurrentQuestion;
    }) => {
      setHasSubmitted(false);
      setCorrectResult(null);
      setCurrentQuestionIndex(data.questionIndex);
      setQuizState({
        kind: 'active',
        quizSessionId: data.quizSessionId,
        questionIndex: data.questionIndex,
        question: data.question,
      });
      startQuestionTimer();
    };

    const onEnd = (data: { quizSessionId: string }) => {
      clearQuestionTimer();
      setQuizState({ kind: 'ended', quizSessionId: data.quizSessionId });
    };

    const onLeaderboard = (data: { quizSessionId: string; leaderboard: LeaderboardEntry[] }) => {
      clearQuestionTimer();
      // Don't overwrite an active question with leaderboard — let the overlay
      // remain visible (showing feedback) until quiz:end arrives.
      if (quizStateRef.current.kind === 'active') {
        // Store leaderboard data for later but keep showing active question
        return;
      }
      setQuizState({
        kind: 'leaderboard',
        quizSessionId: data.quizSessionId,
        entries: data.leaderboard,
      });
    };

    const onAnswerResult = (data: QuizAnswerResult & { quizSessionId: string; userId: string }) => {
      console.log('[useQuizSocket] quiz:answer received:', data, 'myUserId=', userId, 'match=', data.userId === userId);
      if (data.userId === userId) {
        setCorrectResult(data.correct);
      }
    };

    socket.on('quiz:question', onQuestion);
    socket.on('quiz:end', onEnd);
    socket.on('quiz:leaderboard', onLeaderboard);
    socket.on('quiz:answer', onAnswerResult);

    return () => {
      socket.off('quiz:question', onQuestion);
      socket.off('quiz:end', onEnd);
      socket.off('quiz:leaderboard', onLeaderboard);
      socket.off('quiz:answer', onAnswerResult);
      clearQuestionTimer();
    };
  }, [socket, userId, startQuestionTimer, clearQuestionTimer]);

  const submitAnswer = useCallback(
    (optionId: string) => {
      console.log('[useQuizSocket] submitAnswer called:', { optionId, hasSubmitted, timer, kind: quizState.kind });
      if (hasSubmitted || timer <= 0) return;
      if (quizState.kind !== 'active') return;

      socket?.emit('quiz-answer', {
        quizSessionId: quizState.quizSessionId,
        optionId,
      });
      setHasSubmitted(true);
    },
    [socket, hasSubmitted, timer, quizState]
  );

  const isDisabled = hasSubmitted || timer <= 0;

  return {
    quizState,
    timer,
    hasSubmitted,
    isDisabled,
    correctResult,
    submitAnswer,
    currentQuestionIndex,
  };
}
