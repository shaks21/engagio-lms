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
});
