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

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

// ─────────────────────────────
//  T E S T S
// ─────────────────────────────

describe('BreakoutTab — Sidebar Room List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {}, groupCount: 2 }) } as Response);
  });

  it('shows "Create Rooms" button for teachers', async () => {
    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    expect(screen.getByTestId('create-rooms-btn')).toBeInTheDocument();
    expect(screen.getByTestId('create-rooms-btn')).toHaveTextContent('Create Rooms');
  });

  it('shows room list with Main Room and configured rooms', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: { s1: 'room-a', s2: 'room-a', s3: 'room-b' },
        groupCount: 2,
      }),
    });

    setRemoteStudents(['s1', 's2', 's3']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    await waitFor(() => {
      const roomCards = screen.queryAllByTestId('breakout-room-card');
      expect(roomCards.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('each room card shows student count', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: { s1: 'room-a', s2: 'room-a', s3: 'room-b' },
        groupCount: 2,
      }),
    });

    setRemoteStudents(['s1', 's2', 's3']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" socket={createMockSocket()} />);
      await flushPromises();
    });

    await waitFor(() => {
      const counts = screen.queryAllByTestId('room-student-count');
      expect(counts.length).toBeGreaterThan(0);
    });
  });

  it('shows Close All Rooms button when rooms have assignments', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: { s1: 'room-a', s2: 'room-b' },
        groupCount: 2,
      }),
    });

    setRemoteStudents(['s1', 's2']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('close-all-rooms-btn')).toBeInTheDocument();
    });
  });
});

describe('BreakoutTab — Modal Integration (Auto Shuffle)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ assignments: {}, groupCount: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ assignments: { s1: 'room-a', s2: 'room-b', s3: 'room-a', s4: 'room-b' } }) });
  });

  it('opening modal and clicking Create triggers auto-shuffle and shows rooms', async () => {
    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // Open modal
    await user.click(screen.getByTestId('create-rooms-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('create-breakout-modal')).toBeInTheDocument();
    });

    // Auto mode is default — click Create
    await user.click(screen.getByTestId('modal-create-btn'));

    // Modal should close, rooms should appear
    await waitFor(() => {
      expect(screen.queryByTestId('create-breakout-modal')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId('breakout-room-card').length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('BreakoutTab — Modal Integration (Manual Allocation)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {}, groupCount: 2 }) } as Response);
  });

  it('opening modal, selecting manual mode, and assigning students works', async () => {
    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // Open modal
    await user.click(screen.getByTestId('create-rooms-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('create-breakout-modal')).toBeInTheDocument();
    });

    // Select manual mode
    await user.click(screen.getByTestId('mode-manual'));

    await waitFor(() => {
      expect(screen.getByTestId('manual-unassigned-pool')).toBeInTheDocument();
    });

    // Assign first student to first room
    const assignBtns = screen.queryAllByTestId(/^manual-assign-btn-/);
    expect(assignBtns.length).toBeGreaterThan(0);

    await user.click(assignBtns[0]);

    // Pool count should decrease
    await waitFor(() => {
      const pool = screen.getByTestId('manual-unassigned-pool');
      expect(pool.textContent).not.toMatch(/4 students/);
    });
  });
});

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
    expect(btn.className).toMatch(/bg-engagio/);

    // Simulate broadcast started
    await act(async () => {
      mockSocket.on.mock.calls
        .filter((c: any) => c[0] === 'broadcast-state-changed')
        .forEach((c: any) => c[1]({ isBroadcasting: true }));
    });

    const btnAfter = screen.getByTestId('broadcast-audio-btn');
    expect(btnAfter.textContent).toMatch(/Stop Broadcast/i);
    expect(btnAfter.className).toMatch(/bg-green-600|bg-engagio-600|text-green/i);
  });

  it('does not show live broadcast badge initially', async () => {
    const mockSocket = createMockSocket();

    await act(async () => {
      render(<BreakoutTab roomName="demo" socket={mockSocket} />);
      await flushPromises();
    });

    const badge = screen.queryByTestId('live-broadcast-indicator');
    expect(badge).toBeNull();
  });
});
