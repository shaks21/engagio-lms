import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import CreateBreakoutModal from '../CreateBreakoutModal';

const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('CreateBreakoutModal — Bug Fixes', () => {
  const user = userEvent.setup();

  const hostIdentity = 'host-1';

  const defaultProps = {
    roomName: 'demo-session',
    students: [
      { identity: 's1', name: 'Alice' },
      { identity: 's2', name: 'Bob' },
      { identity: 's3', name: 'Charlie' },
      { identity: 's4', name: 'Diana' },
    ],
    hostIdentity,
    currentRoomCount: 4,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('engagio_token', 'test-token');
    globalFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  });

  // ── Bug 1: Auto shuffle must keep host in main room ──
  it('auto mode PATCH body keeps host in main room and includes all students', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = (globalFetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);

    // Host must be in main room
    expect(body.assignments[hostIdentity]).toBe('main');

    // All students must be assigned somewhere (not main)
    expect(body.assignments['s1']).not.toBe('main');
    expect(body.assignments['s2']).not.toBe('main');
    expect(body.assignments['s3']).not.toBe('main');
    expect(body.assignments['s4']).not.toBe('main');
  });

  // ── Bug 2: Manual mode must show ALL users (including host) to assign ──
  it('manual mode shows all participants including host in unassigned pool', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const manualCard = screen.getByTestId('mode-manual');
    await user.click(manualCard);

    await waitFor(() => {
      const pool = screen.getByTestId('manual-unassigned-pool');
      expect(pool.textContent).toContain('Alice');
      expect(pool.textContent).toContain('Bob');
    });
  });

  // ── Bug 3: Self-select mode sends assignmentMode and groupCount ──
  it('self-select mode PATCH body includes assignmentMode and groupCount', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const selfCard = screen.getByTestId('mode-self-select');
    await user.click(selfCard);

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = (globalFetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);

    expect(body.assignmentMode).toBe('SELF_SELECT');
    expect(body.groupCount).toBe(4);
  });

  // ── Bug 3: Self-select shows room cards for students to pick from ──
  it('self-select mode shows available room cards for student selection', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    await user.click(screen.getByTestId('mode-self-select'));

    await waitFor(() => {
      const roomCards = screen.queryAllByTestId('self-select-room-card');
      expect(roomCards.length).toBe(4); // room-a, room-b, room-c, room-d
    });
  });

  // ── Bug 4: PATCH persists groupCount so rooms survive tab change ──
  it('auto mode PATCH body includes groupCount', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = (globalFetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);
    expect(body.groupCount).toBe(4);
  });

  // ── Bug 6: Manual mode merges with existingAssignments; unassigned students stay in their existing rooms ──
  it('manual mode preserves existing room assignments for students not explicitly reassigned', async () => {
    const existingAssignments = {
      s1: 'room-a',
      s2: 'room-b',
      s3: 'room-c',
      s4: 'room-d',
      'host-1': 'main',
    };

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} existingAssignments={existingAssignments} />);
      await flushPromises();
    });

    // Switch to manual mode
    await user.click(screen.getByTestId('mode-manual'));

    // Verify manual panel rendered
    await waitFor(() => {
      expect(screen.getByTestId('manual-unassigned-pool')).toBeInTheDocument();
    });

    // With all students already in existingAssignments, all are pre-seeded in manualAssignments
    // No need to reassign anyone — just click Create
    await user.click(screen.getByTestId('modal-create-btn'));

    await waitFor(() => {
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = (globalFetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);

    // Verify MANUAL mode is sent
    expect(body.assignmentMode).toBe('MANUAL');

    // All students should still be in their original rooms (merged from existing)
    expect(body.assignments['s1']).toBe('room-a');
    expect(body.assignments['s2']).toBe('room-b');
    expect(body.assignments['s3']).toBe('room-c');
    expect(body.assignments['s4']).toBe('room-d');
    // host stays in main
    expect(body.assignments['host-1']).toBe('main');
  });

  // ── Bug 7: existingAssignments pre-seeds manualAssignments state so editing works on reconfiguration ──
  it('pre-seeds manualAssignments from existingAssignments prop on mount', async () => {
    const existingAssignments = {
      s1: 'room-a',
      s2: 'room-b',
      s3: 'room-b',
    };

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} existingAssignments={existingAssignments} />);
      await flushPromises();
    });

    // Switch to manual mode
    await user.click(screen.getByTestId('mode-manual'));

    // s1 (Alice) should NOT appear in unassigned pool (already assigned to room-a)
    await waitFor(() => {
      const pool = screen.getByTestId('manual-unassigned-pool');
      const text = pool.textContent || '';
      expect(text).toContain('Unassigned');
      // Diana is the only one not in existingAssignments (s4)
      expect(text).toContain('Diana');
      // Alice should NOT be in the unassigned pool
      expect(text).not.toContain('Alice');
    });

    // Room columns should show s1 in room-a and s2/s3 in room-b
    const roomColumns = screen.getAllByTestId('manual-room-column');
    const roomA = roomColumns[0]; // room-a
    const roomB = roomColumns[1]; // room-b
    expect(roomA.textContent).toContain('Alice');
    expect(roomB.textContent).toContain('Bob');
    expect(roomB.textContent).toContain('Charlie');
  });

  // ── Bug 8: Self-select PATCH preserves existing assignments instead of sending empty map ──
  it('self-select mode PATCH body preserves existing assignments', async () => {
    const existingAssignments = {
      s1: 'room-a',
      s2: 'room-b',
    };

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} existingAssignments={existingAssignments} />);
      await flushPromises();
    });

    await user.click(screen.getByTestId('mode-self-select'));
    await user.click(screen.getByTestId('modal-create-btn'));

    await waitFor(() => {
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = (globalFetch as any).mock.calls.find(
      (c: any) => c[1]?.method === 'PATCH'
    );
    const body = JSON.parse(patchCall[1].body);

    expect(body.assignments['s1']).toBe('room-a');
    expect(body.assignments['s2']).toBe('room-b');
    expect(body.assignmentMode).toBe('SELF_SELECT');
  });
});
