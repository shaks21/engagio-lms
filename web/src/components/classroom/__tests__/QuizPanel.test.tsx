import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import QuizPanel from '../QuizPanel';

/* ── mutable mock state ── */
const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

/* ── mock socket ── */
function createMockSocket() {
  const handlers: Record<string, Function[]> = {};
  const em: Record<string, any[][]> = {};
  return {
    emit: vi.fn((event: string, ...args: any[]) => {
      em[event] = em[event] || [];
      em[event].push(args);
    }),
    on: vi.fn((event: string, handler: Function) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(handler);
    }),
    off: vi.fn(),
    trigger: (event: string, data: any) => {
      (handlers[event] || []).forEach((h) => h(data));
    },
    emissions: em,
  };
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

// ─────────────────────────────
//  T E S T S
// ─────────────────────────────

describe('QuizPanel — Start Quiz Flow', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('engagio_token', 'test-token');
  });

  it('shows "Start Quiz" button text on the submit button', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'quiz-sess-001' }),
    } as Response);

    const mockSocket = createMockSocket();

    await act(async () => {
      render(<QuizPanel sessionId="demo" socket={mockSocket} isTeacher={true} />);
      await flushPromises();
    });

    // The initial creation form shows "Start Quiz" (renamed from "Create Quiz")
    expect(screen.getByTestId('submit-quiz-btn').textContent).toMatch(/Start Quiz/i);
  });

  it('clicking Start Quiz creates quiz and auto-broadcasts quiz-start to all students', async () => {
    globalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'quiz-sess-002', totalQuestions: 1 }),
    } as Response);

    const mockSocket = createMockSocket();

    await act(async () => {
      render(<QuizPanel sessionId="demo" socket={mockSocket} isTeacher={true} />);
      await flushPromises();
    });

    // Fill in one question
    await user.type(screen.getByTestId('question-input-0'), 'What is the capital of France?');
    await user.type(screen.getByTestId('option-input-0-0'), 'Paris');
    await user.type(screen.getByTestId('option-input-0-1'), 'London');
    await user.click(screen.getByTestId('correct-checkbox-0-0'));

    // Click Start Quiz → creates via API and auto-emits quiz-start
    await user.click(screen.getByTestId('submit-quiz-btn'));

    // After creation resolves, socket should emit quiz-start
    await waitFor(() => {
      const calls = mockSocket.emissions['quiz-start'] || [];
      expect(calls.length).toBeGreaterThan(0);
    });

    const startCall = (mockSocket.emissions['quiz-start'] || [])[0];
    expect(startCall[0]).toMatchObject({ quizSessionId: 'quiz-sess-002', sessionId: 'demo' });

    // The quiz panel should now show active state (Next Question button)
    await waitFor(() => {
      expect(screen.getByTestId('next-question-btn')).toBeInTheDocument();
    });
  });
});
