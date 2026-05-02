import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import CreateBreakoutModal from '../CreateBreakoutModal';

const globalFetch = vi.fn();
(globalThis as any).fetch = globalFetch;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('CreateBreakoutModal — Save Allocations Deep Fix', () => {
  const user = userEvent.setup();

  const defaultProps = {
    roomName: 'demo-session',
    students: [
      { identity: 's1', name: 'Alice' },
      { identity: 's2', name: 'Bob' },
    ],
    hostIdentity: 'host-1',
    currentRoomCount: 2,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('engagio_token', 'test-token');

    // Mock setSinkId support on prototype so hasSetSinkIdSupport() returns true
    if (typeof HTMLMediaElement !== 'undefined') {
      (HTMLMediaElement.prototype as any).setSinkId = vi.fn().mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    delete (HTMLMediaElement.prototype as any).setSinkId;
  });

  it('does NOT call onCreated when server returns 500', async () => {
    globalFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Internal Server Error' });

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      expect(globalFetch).toHaveBeenCalled();
    });
    await flushPromises();

    expect(defaultProps.onCreated).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('displays error text in the UI when server returns 400', async () => {
    globalFetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' });

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      const errorEl = screen.queryByTestId('modal-error-msg');
      expect(errorEl).toBeInTheDocument();
    });
  });

  it('calls onCreated when server returns 200', async () => {
    // Make shuffle deterministic: every shuffle returns same order
    const originalRandom = Math.random;
    Math.random = () => 0;

    globalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, assignments: { s1: 'room-a', s2: 'room-b' } }),
    });

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      expect(defaultProps.onCreated).toHaveBeenCalled();
    });

    expect(defaultProps.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ s1: 'room-b', s2: 'room-a', 'host-1': 'main' }),
      2,
      'AUTO',
    );

    Math.random = originalRandom;
  });

  it('clears loading spinner and enables Create button after error', async () => {
    globalFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' });

    await act(async () => {
      render(<CreateBreakoutModal {...defaultProps} />);
      await flushPromises();
    });

    const createBtn = screen.getByTestId('modal-create-btn');
    await user.click(createBtn);

    await waitFor(() => {
      expect(createBtn).not.toBeDisabled();
    });
  });
});
