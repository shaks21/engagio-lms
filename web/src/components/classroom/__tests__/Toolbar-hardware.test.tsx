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

describe('Toolbar — Hardware Deep Fix', () => {
  const user = userEvent.setup();
  let mockStopVideo: any;
  let mockSwitchActiveDevice: any;
  let toastMessages: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    toastMessages = [];
    mockStopVideo = vi.fn();
    mockSwitchActiveDevice = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
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
      switchActiveDevice: mockSwitchActiveDevice,
      localParticipant: {
        getTrackPublication: vi.fn((kind: string) =>
          kind === 'video'
            ? { track: { stop: mockStopVideo } }
            : undefined
        ),
      },
    },
    ...overrides,
  });

  it('stops existing video tracks BEFORE calling switchActiveDevice when switching camera', async () => {
    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockStopVideo).toHaveBeenCalledTimes(1);
      expect(mockSwitchActiveDevice).toHaveBeenCalledTimes(1);
    });

    const stopOrder = mockStopVideo.mock.invocationCallOrder[0];
    const switchOrder = mockSwitchActiveDevice.mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(switchOrder);
  });

  it('falls back to user camera when environment switch fails', async () => {
    mockSwitchActiveDevice
      .mockRejectedValueOnce(new Error('OverconstrainedError'))
      .mockResolvedValueOnce(undefined);

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockSwitchActiveDevice).toHaveBeenNthCalledWith(1, 'videoinput', undefined, true, { facingMode: 'environment' });
    });

    await waitFor(() => {
      expect(mockSwitchActiveDevice).toHaveBeenNthCalledWith(2, 'videoinput', undefined, true, { facingMode: 'user' });
    });

    expect(toastMessages.some((t) => t.type === 'warning')).toBe(true);
  });

  it('shows user-friendly toast when both camera directions fail', async () => {
    mockSwitchActiveDevice.mockRejectedValue(new Error('NotAllowedError'));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(toastMessages.some((t) => t.type === 'error')).toBe(true);
    });

    const errorToast = toastMessages.find((t) => t.type === 'error');
    expect(errorToast.message).toMatch(/camera|use|another|permission/i);
  });

  it('does not crash when switchActiveDevice rejects', async () => {
    mockSwitchActiveDevice.mockRejectedValue(new Error('Device in use'));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));
    await flushPromises();

    // Component should still be in the DOM (not crashed)
    expect(screen.getByTestId('settings-btn')).toBeInTheDocument();
  });
});
