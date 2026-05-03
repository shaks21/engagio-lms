import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import CreateBreakoutModal from '../CreateBreakoutModal';

/* ── mocks ── */
const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

/* ─────────────────────────────
  CreateBreakoutModal tests
 ───────────────────────────── */

describe('CreateBreakoutModal', () => {
  const user = userEvent.setup();

  const defaultProps = {
    roomName: 'demo-session',
    students: [
      { identity: 's1', name: 'Alice' },
      { identity: 's2', name: 'Bob' },
      { identity: 's3', name: 'Charlie' },
      { identity: 's4', name: 'Diana' },
    ],
    currentRoomCount: 2,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('engagio_token', 'test-token');
  });

  it('renders modal title and close button', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    expect(screen.getByText('Create Breakout Rooms')).toBeInTheDocument();
    expect(screen.getByTestId('modal-close-btn')).toBeInTheDocument();
  });

  it('defaults to currentRoomCount in the dropdown', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    expect(select.value).toBe('2');
  });

  it('increments room count via dropdown selection', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    await user.selectOptions(select, '3');

    await waitFor(() => {
      expect(select.value).toBe('3');
    });
  });

  it('does not decrement below 1 (dropdown option 1 exists)', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} currentRoomCount={1} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    expect(select.value).toBe('1');

    const options = Array.from(select.querySelectorAll('option'));
    expect(options[0].value).toBe('1');
  });

  it('does not offer above 25 (max options capped)', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} currentRoomCount={25} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.length).toBe(25);
    expect(select.value).toBe('25');
  });

  it('shows three allocation mode cards: Auto, Manual, Self-Select', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    expect(screen.getByTestId('mode-auto')).toBeInTheDocument();
    expect(screen.getByTestId('mode-manual')).toBeInTheDocument();
    expect(screen.getByTestId('mode-self-select')).toBeInTheDocument();

    expect(screen.getByText('Assign Automatically')).toBeInTheDocument();
    expect(screen.getByText('Assign Manually')).toBeInTheDocument();
    expect(screen.getByText('Let Students Choose')).toBeInTheDocument();
  });

  it('auto mode is selected by default', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const autoCard = screen.getByTestId('mode-auto');
    expect(autoCard.className).toMatch(/ring-blue|border-blue|bg-blue/);
  });

  it('clicking manual card selects manual mode', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const manualCard = screen.getByTestId('mode-manual');
    await user.click(manualCard);

    await waitFor(() => {
      expect(manualCard.className).toMatch(/ring-blue|border-blue|bg-blue/);
    });
  });

  it('in auto mode, Create button is red and calls API with assignments', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: { s1: 'room-a', s2: 'room-b', s3: 'room-a', s4: 'room-b' },
      }),
    });

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    expect(createBtn.className).toMatch(/bg-red|bg-rose/);
    expect(createBtn).toHaveTextContent('Create');

    await user.click(createBtn);

    await waitFor(() => {
      expect(globalFetch).toHaveBeenCalled();
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => String(c[0]).includes('/breakouts') && c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
    });

    await waitFor(() => {
      expect(defaultProps.onCreated).toHaveBeenCalled();
    });
  });

  it('in manual mode, shows student pool and room columns before creating', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const manualCard = screen.getByTestId('mode-manual');
    await user.click(manualCard);

    await waitFor(() => {
      expect(screen.getByTestId('manual-unassigned-pool')).toBeInTheDocument();
    });

    const roomColumns = screen.queryAllByTestId('manual-room-column');
    expect(roomColumns.length).toBe(2); // currentRoomCount = 2
  });

  it('in manual mode, clicking assign moves student to room column', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const manualCard = screen.getByTestId('mode-manual');
    await user.click(manualCard);

    await waitFor(() => {
      expect(screen.getByTestId('manual-unassigned-pool')).toBeInTheDocument();
    });

    // Click first assign button (should be for room-a)
    const assignBtns = screen.queryAllByTestId(/^manual-assign-btn-/);
    expect(assignBtns.length).toBeGreaterThan(0);

    await user.click(assignBtns[0]);

    await waitFor(() => {
      const pool = screen.getByTestId('manual-unassigned-pool');
      // One student moved out, so pool should show 3 remaining (4 - 1)
      expect(pool.textContent).toMatch(/3 students/);
    });
  });

  it('calls onClose when X button clicked', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const closeBtn = screen.getByTestId('modal-close-btn');
    await user.click(closeBtn);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows student allocation summary below room count', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    // 4 students, 2 rooms => 2 each
    expect(screen.getByTestId('room-capacity-hint')).toBeInTheDocument();
    expect(screen.getByTestId('room-capacity-hint').textContent).toMatch(/4/);
  });
});
