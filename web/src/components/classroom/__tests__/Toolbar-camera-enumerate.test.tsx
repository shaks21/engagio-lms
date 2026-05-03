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

describe('Toolbar — EnumerateDevices Camera Switch', () => {
  const user = userEvent.setup();
  let mockSetCameraEnabled: any;
  let toastMessages: any[];
  let mockEnumerateDevices: any;

  const makeMockDevices = (labels: string[]) =>
    labels.map((label, i) => ({
      deviceId: `d${i}`,
      kind: 'videoinput',
      label,
      groupId: `g${i}`,
    }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toastMessages = [];
    mockSetCameraEnabled = vi.fn().mockResolvedValue(undefined);
    mockEnumerateDevices = vi.fn();
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: { enumerateDevices: mockEnumerateDevices },
      configurable: true,
    });
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

  it('calls enumerateDevices before republishing', async () => {
    mockEnumerateDevices.mockResolvedValue(makeMockDevices(['Front Camera', 'Back Camera']));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockEnumerateDevices).toHaveBeenCalledTimes(1);
    });
  });

  it('uses { deviceId: { exact: matchedId } } when rear camera label found', async () => {
    mockEnumerateDevices.mockResolvedValue(makeMockDevices(['Front Camera', 'Back Dual Camera']));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(2);
    });

    expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(2, true, expect.objectContaining({
      deviceId: { exact: 'd1' },
    }));
  });

  it('uses { deviceId: { exact: matchedId } } for front camera label', async () => {
    mockEnumerateDevices.mockResolvedValue(makeMockDevices(['FaceTime HD Camera (Built-in)', 'Logitech C920']));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📷 Front'));

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(2);
    });

    expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(2, true, expect.objectContaining({
      deviceId: { exact: 'd0' },
    }));
  });

  it('falls back to { ideal: facingMode } when no matching device label found', async () => {
    mockEnumerateDevices.mockResolvedValue(makeMockDevices(['Camera 1', 'Camera 2']));

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(2);
    });

    expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(2, true, expect.objectContaining({
      facingMode: { ideal: 'environment' },
    }));
    // Should NOT include deviceId when no match
    const lastCall = mockSetCameraEnabled.mock.calls[1][1];
    expect(lastCall).not.toHaveProperty('deviceId');
  });

  it('falls back to { ideal: facingMode } when enumerateDevices is unavailable', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      value: undefined,
      configurable: true,
    });

    const props = makeProps();
    render(<Toolbar {...props} />);
    await flushPromises();

    await user.click(screen.getByTestId('settings-btn'));
    await user.click(screen.getByText('📸 Rear'));

    await waitFor(() => {
      expect(mockSetCameraEnabled).toHaveBeenCalledTimes(2);
    });

    expect(mockSetCameraEnabled).toHaveBeenNthCalledWith(2, true, expect.objectContaining({
      facingMode: { ideal: 'environment' },
    }));
  });
});
