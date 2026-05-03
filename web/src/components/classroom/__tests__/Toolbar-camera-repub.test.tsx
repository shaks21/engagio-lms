import React from 'react';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect, afterEach } from 'vitest';
import Toolbar from '../Toolbar';

/* ─── mocks ─── */
vi.mock('@/hooks/useLoudspeaker', () => ({
  useLoudspeaker: vi.fn(() => ({
    isSpeaker: true,
    isSupported: true,
    setSpeaker: vi.fn(),
    forceSpeaker: vi.fn(),
  })),
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('Toolbar — Camera Stop-Publish-Repub Fix', () => {
  const user = userEvent.setup();
  let mockSetCameraEnabled: any;
  let toastMessages: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toastMessages = [];
    mockSetCameraEnabled = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const makeProps = (overrides = {}) => ({
    micMuted: false,
    cameraOff: false,
    handRaised: false,
    screenShareActive: false,
    unreadChatCount: 0,
    onToggleMic: vi.fn(),
    onToggleCamera: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onToggleHandRaise: vi.fn(),
    onToggleChat: vi.fn(),
    onLeave: vi.fn(),
    onToast: (t: any) => { toastMessages.push(t); },
    room: {
      switchActiveDevice: vi.fn().mockResolvedValue(undefined),
      localParticipant: {
        setCameraEnabled: mockSetCameraEnabled,
      },
    },
    ...overrides,
  });

  it('calls setCameraEnabled(false) FIRST, waits, then setCameraEnabled(true, { ideal: facing })', async () => {
    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(1);
      expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(1, false);
    });

    // Advance timers past the delay
    await act(async () => { vi.advanceTimersByTime(600); });

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(2);
      expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(2, true, expect.objectContaining({
        facingMode: { ideal: 'environment' },
      }));
    });
  });

  it('uses { ideal: "user" } when switching to front camera', async () => {
    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    // First click rear
    await user.click(screen.getByText('📸 Rear'));
    await act(async () => { vi.advanceTimersByTime(600); });

    // Then click front
    await user.click(screen.getByText('📷 Front'));

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(3); // false, true rear, false
    });

    await act(async () => { vi.advanceTimersByTime(600); });

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(4); // + true user
      expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(4, true, expect.objectContaining({
        facingMode: { ideal: 'user' },
      }));
    });
  });

  it('shows toast when republish fails after both stop and publish fail', async () => {
    // All calls fail: false → true env → true user fallback
    mockSetCameraEnabled.mockRejectedValue(new Error('NotAllowedError'));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    // Wait for all 3 calls: false, true env, true user fallback
    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(3);
    });

    await flushPromises();

    await waitFor(() => {
      expect(toastMessages.some((t) => t.type === 'error')).toBe(true);
    });
  });

  it('shows warning toast and falls back to user if environment publish fails', async () => {
    // setCameraEnabled(false) succeeds, setCameraEnabled(true, env) fails, setCameraEnabled(true, user) succeeds
    mockSetCameraEnabled
      .mockResolvedValueOnce(undefined) // false
      .mockRejectedValueOnce(new Error('OverconstrainedError')) // true env fails
      .mockResolvedValueOnce(undefined); // true user fallback

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    // Wait for all 3 calls: false, true env, true user
    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(3);
    });

    await flushPromises();

    expect(toastMessages.some((t) => t.type === 'warning' && /rear|front/i.test(t.message))).toBe(true);
  });
});
