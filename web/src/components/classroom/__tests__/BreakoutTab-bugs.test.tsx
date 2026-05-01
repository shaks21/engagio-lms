import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import BreakoutTab from '../BreakoutTab';

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

function createMockSocket() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

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

describe('BreakoutTab — Bug 4: Persistence across tab changes', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
  });

  it('fetches from API and shows rooms configured with groupCount=4', async () => {
    // Simulating re-mount after tab change: API returns assignments + groupCount
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: {
          s1: 'room-a',
          s2: 'room-b',
          s3: 'room-c',
          s4: 'room-d',
        },
        groupCount: 4,
        assignmentMode: 'AUTO',
      }),
    });

    setRemoteStudents(['s1', 's2', 's3', 's4']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // Should show 4 room cards + Main Room = 5 total
    await waitFor(() => {
      const roomCards = screen.queryAllByTestId('breakout-room-card');
      expect(roomCards.length).toBe(5); // main + room-a + room-b + room-c + room-d
    });
  });

  it('fetches from API with groupCount larger than room IDs still shows all rooms', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: {
          s1: 'room-c',
          s2: 'room-d',
        },
        groupCount: 6, // room-a through room-f
        assignmentMode: 'AUTO',
      }),
    });

    setRemoteStudents(['s1', 's2']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" />);
      await flushPromises();
    });

    // Should show Main Room + room-a through room-f = 7
    await waitFor(() => {
      const roomCards = screen.queryAllByTestId('breakout-room-card');
      expect(roomCards.length).toBe(7);
    });

    // room-c and room-d should have the students
    expect(screen.getByText(/room-c/i)).toBeInTheDocument();
    expect(screen.getByText(/room-d/i)).toBeInTheDocument();
    expect(screen.getByText(/room-a/i)).toBeInTheDocument();
    expect(screen.getByText(/room-f/i)).toBeInTheDocument();
  });
});

describe('BreakoutTab — Bug 5: Join button disabled when no rooms exist', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockParticipants = [];
    mockLocal = null;
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({ assignments: {} }) } as Response);
  });

  it('Join button emits socket event with correct roomId', async () => {
    const mockSocket = createMockSocket();

    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: { s1: 'room-a', s2: 'room-b' },
        groupCount: 2,
      }),
    });

    setRemoteStudents(['s1', 's2']);

    await act(async () => {
      render(<BreakoutTab roomName="demo" socket={mockSocket} />);
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('join-room-room-a')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('join-room-room-a'));

    // Should emit 'join-breakout-room' event via socket
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'join-breakout-room',
        expect.objectContaining({ sessionId: 'demo', roomId: 'room-a' }),
      );
    });
  });
});
