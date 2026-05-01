import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Sidebar, { type SidebarTab } from '../Sidebar';

/* ── mocks ── */
const mockParticipants: any[] = [];
const mockLocal: any = null;

vi.mock('@livekit/components-react', () => ({
  useParticipants: vi.fn(() => mockParticipants),
  useLocalParticipant: vi.fn(() => ({ localParticipant: mockLocal })),
  useIsSpeaking: vi.fn(() => false),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1', name: 'Test User', role: 'TEACHER' } })),
}));

vi.mock('@/hooks/useEngagement', () => ({
  useEngagement: vi.fn(() => ({ scores: [] })),
}));

vi.mock('@/hooks/useQuizSocket', () => ({
  useQuizSocket: vi.fn(() => ({ activeQuiz: null, currentQuestion: null, quizEnded: false })),
}));

/* mocks for Chat component */
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const flush = () => new Promise((r) => setTimeout(r, 10));

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const defaultProps = {
    open: true,
    tab: 'chat' as SidebarTab,
    onTabChange: vi.fn(),
    onClose: vi.fn(),
    sessionId: 'demo-session',
    socket: null,
    userId: 'u1',
    userName: 'Test User',
    unreadChatCount: 0,
    onResetChatCount: vi.fn(),
    chatMessages: [],
    onAddChatMessage: vi.fn(),
    isTeacher: true,
    polls: [],
  };
  return render(<Sidebar {...defaultProps} {...props} />);
}

/* ─────────────────────────────
  SIDEBAR REDESIGN TESTS
  ───────────────────────────── */

describe('Sidebar Redesign — Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a vertical icon rail on the left', async () => {
    await act(async () => {
      renderSidebar();
      await flush();
    });

    const rail = screen.getByTestId('sidebar-icon-rail');
    expect(rail).toBeInTheDocument();

    // Should have icon buttons for each tab
    expect(screen.getByTestId('rail-btn-chat')).toBeInTheDocument();
    expect(screen.getByTestId('rail-btn-participants')).toBeInTheDocument();
    expect(screen.getByTestId('rail-btn-qa')).toBeInTheDocument();
    expect(screen.getByTestId('rail-btn-poll')).toBeInTheDocument();
    expect(screen.getByTestId('rail-btn-quiz')).toBeInTheDocument();
    expect(screen.getByTestId('rail-btn-breakout')).toBeInTheDocument();
  });

  it('active tab button has blue rounded-square background', async () => {
    await act(async () => {
      renderSidebar({ tab: 'quiz' });
      await flush();
    });

    const quizBtn = screen.getByTestId('rail-btn-quiz');
    const iconContainer = quizBtn.querySelector('div');
    expect(iconContainer?.className).toMatch(/bg-blue-600/);
    expect(iconContainer?.className).toMatch(/rounded/);

    // Other buttons should NOT have the active blue background
    const chatBtn = screen.getByTestId('rail-btn-chat');
    const chatIconContainer = chatBtn.querySelector('div');
    expect(chatIconContainer?.className).not.toMatch(/bg-blue-600/);
  });

  it('content panel shows the active tab name in the header', async () => {
    await act(async () => {
      renderSidebar({ tab: 'quiz' });
      await flush();
    });

    const header = screen.getByTestId('sidebar-content-header');
    expect(header.textContent).toMatch(/Quiz|Create Quiz/i);
  });

  it('clicking a rail button switches the active tab', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    await act(async () => {
      renderSidebar({ tab: 'chat', onTabChange });
      await flush();
    });

    const pollBtn = screen.getByTestId('rail-btn-poll');
    await user.click(pollBtn);

    expect(onTabChange).toHaveBeenCalledWith('poll');
  });
});
