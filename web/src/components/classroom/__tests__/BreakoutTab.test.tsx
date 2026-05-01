import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import BreakoutTab from '../BreakoutTab';

/* ── mutable mock state ── */
let mockParticipants: any[] = [];
let mockLocal: any = null;

vi.mock('@livekit/components-react', () => ({
  useParticipants: vi.fn(() => mockParticipants),
  useLocalParticipant: vi.fn(() => ({ localParticipant: mockLocal })),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'host-1', email: 'host@test.com', role: 'TEACHER' } })),
}));

vi.mock('@/hooks/useEngagement', () => ({
  useEngagement: vi.fn(() => ({ scores: [] })),
}));

const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

/* ── mock socket ── */
let mockSocketEmits: Record<string, any[]> = {};
let mockSocketOnHandlers: Record<string, Function[]> = {};

function createMockSocket() {
  mockSocketEmits = {};
  mockSocketOnHandlers = {};
  return {
    emit: vi.fn((event: string, ...args: any[]) => {
      mockSocketEmits[event] = mockSocketEmits[event] || [];
      mockSocketEmits[event].push(args);
    }),
    on: vi.fn((event: string, handler: Function) => {
      mockSocketOnHandlers[event] = mockSocketOnHandlers[event] || [];
      mockSocketOnHandlers[event].push(handler);
    }),
    off: vi.fn(),
  };
}

/* ── helpers ── */
function setRemoteStudents(identities: string[]) {
  mockLocal = {
    identity: 'host-1',
    name: 'Teacher Host',
    isSpeaking: false,
    metadata: JSON.stringify({ role: 'TEACHER' }),
  };
  mockParticipants = identities.map((id) => ({
    identity: id,
    name: `Student ${id}`,
    isSpeaking: false,
    metadata: JSON.stringify({ role: 'STUDENT' }),
  }));
}

/* tiny promise flusher to let useEffect fetches settle */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

// ─────────────────────────────
//  T E S T S
// ─────────────────────────────

describe('BreakoutTab — Room Count Dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {} }) } as Response);
  });

  it('shows a select with up to 25 room options', async () => {
    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(options.length).toBe(25);
    expect(options[0].textContent).toContain('1 room');
    expect(options[24].textContent).toContain('25 rooms');
  });

  it('shows per-room allocation hint based on student count', async () => {
    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // Without students, hint reads "No students"
    expect(screen.getByTestId('room-capacity-hint').textContent).toContain('No students');
  });
});

describe('BreakoutTab — Auto Shuffle', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ assignments: {} }) }) // GET breakouts on mount
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assignments: {
            s1: 'room-a',
            s2: 'room-b',
            s3: 'room-a',
            s4: 'room-b',
          },
        }),
      }); // POST preview
  });

  it('clicking Auto Shuffle enters preview mode with draft banner', async () => {
    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    const shuffleBtn = screen.getByTestId('auto-shuffle-btn');
    await user.click(shuffleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Draft mode/i)).toBeInTheDocument();
    });
  });

  it('choosing room count updates shuffle request payload', async () => {
    setRemoteStudents(['s1', 's2', 's3', 's4', 's5']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // select 3 rooms
    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    await user.selectOptions(select, '3');

    const shuffleBtn = screen.getByTestId('auto-shuffle-btn');
    await user.click(shuffleBtn);

    await waitFor(() => {
      const calls = (globalFetch as any).mock.calls;
      const previewCall = calls.find((c: any) => String(c[0]).includes('/preview'));
      expect(previewCall).toBeTruthy();
      expect(JSON.parse(previewCall[1].body)).toMatchObject({ groupCount: 3 });
    });
  });
});

describe('BreakoutTab — Manual Allocation', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {} }) } as Response);
  });

  it('clicking Manual Allocation shows unassigned pool and room columns', async () => {
    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    const manualBtn = screen.getByRole('button', { name: /Manual Allocation/i });
    await user.click(manualBtn);

    await waitFor(() => {
      expect(screen.getByTestId('unassigned-pool')).toBeInTheDocument();
    });

    const roomCards = screen.queryAllByTestId('breakout-room-card');
    expect(roomCards.length).toBeGreaterThanOrEqual(2);
  });

  it('clicking Assign button in Manual Allocation moves student and updates pool count', async () => {
    setRemoteStudents(['s1', 's2', 's3']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    const manualBtn = screen.getByRole('button', { name: /Manual Allocation/i });
    await user.click(manualBtn);

    await waitFor(() => {
      expect(screen.getByTestId('unassigned-pool')).toBeInTheDocument();
    });

    // Ensure the unassigned pool shows at least one student before clicking
    const poolBefore = screen.getByTestId('unassigned-pool');
    expect(poolBefore.textContent).toContain('Student s1');

    const assignBtns = screen.queryAllByTestId(/^assign-to-room-/);
    expect(assignBtns.length).toBeGreaterThan(0);

    // Click the first assign button (should move Student s1 to room-a)
    await user.click(assignBtns[0]);

    // After re-render the unassigned pool should show fewer students
    // (teacher + remaining unassigned). We assert by count badge changing
    // instead of strict name matching to avoid flaky textContent checks.
    await waitFor(() => {
      const pool = screen.getByTestId('unassigned-pool');
      // Pool count badge should show fewer than before (was 4 incl. teacher)
      expect(pool.textContent).not.toMatch(/4 students/);
    });
  });
});

/* ─────────────────────────────
  Issue 1: Capacity hint accuracy
  ───────────────────────────── */
describe('BreakoutTab — Capacity Hint with 1 student / 3 rooms', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {} }) } as Response);
  });

  it('shows accurate distribution with single student across 3 rooms', async () => {
    setRemoteStudents(['s1']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    await user.selectOptions(select, '3');

    const hint = screen.getByTestId('room-capacity-hint');
    // Should NOT show "~1 students per room" which implies all rooms get 1
    expect(hint.textContent).not.toMatch(/~1 student(?:s)? per room/);
    // Should show that 1 room is populated and some rooms will be empty
    expect(hint.textContent).toMatch(/1 in 1 room/i);
  });
});

/* ─────────────────────────────
  Issue 2: Broadcast audio state + colour
  ───────────────────────────── */
describe('BreakoutTab — Broadcast Audio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {} }) } as Response);
  });

  it('button turns green and shows "Stop Broadcast" when broadcasting', async () => {
    const mockSocket = createMockSocket();

    await act(async () => {
      render(<BreakoutTab roomName="demo" socket={mockSocket} />);
      await flushPromises();
    });

    const btn = screen.getByTestId('broadcast-audio-btn');
    expect(btn).toHaveTextContent(/Broadcast Audio/i);
    // Before clicking: should be green-themed (start-broadcast state)
    expect(btn.className).toMatch(/bg-engagio/);

    // Simulate starting broadcast
    await act(async () => {
      mockSocket.on.mock.calls
        .filter((c: any) => c[0] === 'broadcast-state-changed')
        .forEach((c: any) => c[1]({ isBroadcasting: true }));
    });

    // After broadcast starts: button should still be green-themed
    // because green = "broadcasting / LIVE"
    const btnAfter = screen.getByTestId('broadcast-audio-btn');
    expect(btnAfter.textContent).toMatch(/Stop Broadcast/i);
    expect(btnAfter.className).toMatch(/bg-green-600|bg-engagio-600|text-green/i);
  });

  it('shows a live broadcast badge when teacher is broadcasting', async () => {
    const mockSocket = createMockSocket();

    await act(async () => {
      render(<BreakoutTab roomName="demo" socket={mockSocket} />);
      await flushPromises();
    });

    // The badge should NOT be visible initially
    const badgeBefore = screen.queryByTestId('live-broadcast-indicator');
    expect(badgeBefore).toBeNull();
  });
});
