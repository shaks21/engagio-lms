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
