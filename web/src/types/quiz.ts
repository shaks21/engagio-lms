/** Shared quiz types for frontend-backend alignment */

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
  points?: number;
}

export interface QuizSession {
  id: string;
  sessionId: string;
  status: 'pending' | 'active' | 'completed';
  currentQuestionIndex: number;
  questions: { pollId: string; createdAt: string }[];
  createdAt: string;
}

export interface CurrentQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
}

export type QuizSocketState =
  | { kind: 'idle' }
  | { kind: 'active'; quizSessionId: string; questionIndex: number; question: CurrentQuestion }
  | { kind: 'leaderboard'; quizSessionId: string; entries: LeaderboardEntry[] }
  | { kind: 'ended'; quizSessionId: string };

export interface LeaderboardEntry {
  userId: string;
  totalScore: number;
  rank: number;
}

export interface QuizAnswerResult {
  score: number;
  correct: boolean;
  totalScore: number;
}
