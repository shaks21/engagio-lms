import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import CreateBreakoutModal from '../CreateBreakoutModal';

/* ── mocks ── */
const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('CreateBreakoutModal — Number Dropdown (up to 25 rooms)', () => {
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

  it('renders a <select> dropdown with data-testid="breakout-room-count"', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count');
    expect(select.tagName.toLowerCase()).toBe('select');
  });

  it('dropdown defaults to currentRoomCount value', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} currentRoomCount={3} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    expect(select.value).toBe('3');
  });

  it('dropdown has options from 1 up to MAX_ROOMS (25)', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.length).toBe(25);

    const values = options.map((o) => Number(o.value));
    expect(values[0]).toBe(1);
    expect(values[24]).toBe(25);
  });

  it('each option shows the room count and allocated student count', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));

    // 4 students, 2 rooms => "2 each"
    const option2 = options.find((o) => o.value === '2');
    expect(option2!.textContent).toMatch(/2\s+rooms?.*students/i);

    // 4 students, 3 rooms => "1-2 each"
    const option3 = options.find((o) => o.value === '3');
    expect(option3!.textContent).toMatch(/3\s+rooms?.*students/i);

    // 4 students, 5 rooms => "empty"
    const option5 = options.find((o) => o.value === '5');
    expect(option5!.textContent).toMatch(/5\s+rooms?.*students/i);
  });

  it('changing dropdown updates room capacity hint', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    const hint = screen.getByTestId('room-capacity-hint');

    // Default: 2 rooms, 4 students => "2 each"
    expect(hint.textContent).toMatch(/2\s+each/);

    // Change to 4 rooms
    await user.selectOptions(select, '4');
    await waitFor(() => {
      expect(hint.textContent).toMatch(/1\s+each/);
    });
  });

  it('auto shuffle mode uses the selected dropdown count', async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assignments: { s1: 'room-a', s2: 'room-b', s3: 'room-c', s4: 'room-d' },
      }),
    });

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    // Change to 4 rooms before clicking Create
    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    await user.selectOptions(select, '4');

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      expect(globalFetch).toHaveBeenCalled();
      const patchCall = (globalFetch as any).mock.calls.find(
        (c: any) => String(c[0]).includes('/breakouts') && c[1]?.method === 'PATCH'
      );
      expect(patchCall).toBeTruthy();
      const body = JSON.parse(patchCall[1].body);
      expect(body.groupCount).toBe(4);
    });
  });

  it('manual allocation mode also respects the selected dropdown count', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    // Select manual mode
    const manualCard = screen.getByTestId('mode-manual');
    await user.click(manualCard);

    await waitFor(() => {
      expect(screen.getByTestId('manual-unassigned-pool')).toBeInTheDocument();
    });

    // Change to 3 rooms
    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    await user.selectOptions(select, '3');

    // Manual panel should show 3 room columns
    await waitFor(() => {
      const roomColumns = screen.queryAllByTestId('manual-room-column');
      expect(roomColumns.length).toBe(3);
    });

    const hint = screen.getByTestId('room-capacity-hint');
    expect(hint.textContent).toMatch(/3/);
  });

  it('no longer renders +/- stepper buttons', async () => {
    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    expect(screen.queryByTestId('room-count-plus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('room-count-minus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('room-count-value')).not.toBeInTheDocument();
  });

  it('dropdown capped at MAX_ROOMS (25) even with more students', async () => {
    const manyStudents = Array.from({ length: 30 }, (_, i) => ({
      identity: `stu-${i}`,
      name: `Student ${i}`,
    }));

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} students={manyStudents} />);
      await flushPromises();
    });

    const select = screen.getByTestId('breakout-room-count') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.length).toBe(25);
    expect(options[24].value).toBe('25');

    // Option 25 should show allocation for 30 students
    const option25 = options.find((o) => o.value === '25');
    expect(option25!.textContent).toMatch(/25\s+rooms?.*students/i);
  });
});
