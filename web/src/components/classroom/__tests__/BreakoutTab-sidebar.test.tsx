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

describe('BreakoutTab — Sidebar Room List View', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {}, groupCount: 2 }) } as Response);
  });

  it('shows "Create Rooms" button for teachers when no rooms configured', async () => {
    globalFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ assignments: {} }) });

    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    expect(screen.getByTestId('create-rooms-btn')).toBeInTheDocument();
  });

  it('clicking Create Rooms button opens the CreateBreakoutModal', async () => {
    setRemoteStudents(['s1', 's2', 's3']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('create-rooms-btn');
    await user.click(createBtn);

    await waitFor(() => {
      expect(screen.getByTestId('create-breakout-modal')).toBeInTheDocument();
    });
  });

  it('shows room list cards when assignments exist', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: {
          s1: 'room-a',
          s2: 'room-a',
          s3: 'room-b',
        },
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

  it('each room card shows student count and monitor/join actions', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: {
          s1: 'room-a',
          s2: 'room-a',
          s3: 'room-b',
        },
        groupCount: 2,
      }),
    });

    setRemoteStudents(['s1', 's2', 's3']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" socket={createMockSocket()} />);
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('room-student-count').length).toBeGreaterThan(0);
    });
  });

  it('shows broadcast audio button', async () => {
    setRemoteStudents(['s1', 's2']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    expect(screen.getByTestId('broadcast-audio-btn')).toBeInTheDocument();
  });

  it('shows peek and notify checkboxes for teachers', async () => {
    setRemoteStudents(['s1', 's2']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    expect(screen.getByTestId('peek-visibility-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('notify-students-toggle')).toBeInTheDocument();
  });
});

describe('BreakoutTab — Modal integration with auto shuffle', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ assignments: {}, groupCount: 2 }) })
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
      });
  });

  it('after modal auto-shuffle create, rooms appear in sidebar', async () => {
    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // Open modal
    const createBtn = screen.getByTestId('create-rooms-btn');
    await user.click(createBtn);

    await waitFor(() => {
      expect(screen.getByTestId('create-breakout-modal')).toBeInTheDocument();
    });

    // Click create (auto mode by default)
    const modalCreate = screen.getByTestId('modal-create-btn');
    await user.click(modalCreate);

    // After API call + re-render, modal should close and rooms should appear
    await waitFor(() => {
      expect(screen.queryByTestId('create-breakout-modal')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      const roomCards = screen.queryAllByTestId('breakout-room-card');
      expect(roomCards.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('BreakoutTab — Close All Rooms button', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {}, groupCount: 2 }) } as Response);
  });

  it('shows Close All Rooms button when rooms exist', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: {
          s1: 'room-a',
          s2: 'room-b',
        },
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
