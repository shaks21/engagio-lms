import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import PreJoin from '../PreJoin';

/* ── mocks ── */
vi.mock('@/hooks/useMediaDevices', () => ({
  useMediaDevices: vi.fn(),
}));

const mockUseMediaDevices = (await import('@/hooks/useMediaDevices')).useMediaDevices;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

/* ── jsdom getUserMedia mock ── */
let mockGUMResult: MediaStream | null = null;
let mockGUMError: Error | null = null;

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn((constraints: any) => {
      if (mockGUMError) return Promise.reject(mockGUMError);
      if (mockGUMResult) return Promise.resolve(mockGUMResult);
      // Return a minimal fake stream
      const fakeTrack = { stop: vi.fn(), kind: 'video', enabled: true } as any;
      return Promise.resolve({ getTracks: () => [fakeTrack] } as any);
    }),
  },
  configurable: true,
});

describe('PreJoin', () => {
  const user = userEvent.setup();
  const defaultProps = {
    roomName: 'demo-room',
    userName: 'Test User',
    onJoin: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGUMResult = null;
    mockGUMError = null;
    // Default mock for useMediaDevices
    (mockUseMediaDevices as any).mockReturnValue({
      videoDevices: [
        { deviceId: 'cam-front', label: 'Front Camera' },
        { deviceId: 'cam-back', label: 'Rear Camera' },
      ],
      audioInputDevices: [{ deviceId: 'mic-1', label: 'Built-in Mic' }],
      hasPermission: true,
      enumerate: vi.fn(),
      facingMode: 'user',
      setFacingMode: vi.fn(),
      selectedCameraId: 'cam-front',
      selectedAudioInputId: 'mic-1',
      getVideoConstraints: vi.fn(() => ({ facingMode: 'user', deviceId: 'cam-front' })),
      getAudioConstraints: vi.fn(() => ({
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 2 },
      })),
      flipCamera: vi.fn(() => {
        // Simulate state change
      }),
    });
  });

  it('renders room name and user name', async () => {
    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });
    expect(screen.getByText('Ready to join?')).toBeInTheDocument();
    expect(screen.getByText(/demo-room/)).toBeInTheDocument();
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('shows camera flip button when camera is enabled', async () => {
    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    // Camera is off by default; enable it
    const camBtn = screen.getByRole('button', { name: /camera/i });
    await user.click(camBtn);

    await waitFor(() => {
      // The flip button (bottom-right of preview) should appear
      expect(screen.getByTitle(/Switch to rear camera/i)).toBeInTheDocument();
    });
  });

  it('flip camera button is visible on mobile even with a single camera device', async () => {
    (mockUseMediaDevices as any).mockReturnValue({
      videoDevices: [{ deviceId: 'cam-1', label: 'Camera' }],
      audioInputDevices: [{ deviceId: 'mic-1', label: 'Mic' }],
      hasPermission: true,
      enumerate: vi.fn(),
      facingMode: 'user',
      setFacingMode: vi.fn(),
      selectedCameraId: 'cam-1',
      selectedAudioInputId: 'mic-1',
      getVideoConstraints: vi.fn(() => ({ facingMode: 'user', deviceId: 'cam-1' })),
      getAudioConstraints: vi.fn(() => ({})),
      flipCamera: vi.fn(),
    });

    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    const camBtn = screen.getByRole('button', { name: /camera/i });
    await user.click(camBtn);

    await waitFor(() => {
      // Should still show flip button even with only 1 camera
      const flipBtn = screen.queryByTitle(/Switch to rear camera/i);
      expect(flipBtn).toBeInTheDocument();
    });
  });

  it('clicking flip camera calls flipCamera from useMediaDevices', async () => {
    const flipMock = vi.fn();
    (mockUseMediaDevices as any).mockReturnValue({
      videoDevices: [{ deviceId: 'cam-1', label: 'Camera' }],
      audioInputDevices: [{ deviceId: 'mic-1', label: 'Mic' }],
      hasPermission: true,
      enumerate: vi.fn(),
      facingMode: 'user',
      setFacingMode: vi.fn(),
      selectedCameraId: 'cam-1',
      selectedAudioInputId: 'mic-1',
      getVideoConstraints: vi.fn(() => ({ facingMode: 'user', deviceId: 'cam-1' })),
      getAudioConstraints: vi.fn(() => ({})),
      flipCamera: flipMock,
    });

    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    const camBtn = screen.getByRole('button', { name: /camera/i });
    await user.click(camBtn);

    await waitFor(() => {
      expect(screen.getByTitle(/Switch to rear camera/i)).toBeInTheDocument();
    });

    const flipBtn = screen.getByTitle(/Switch to rear camera/i);
    await user.click(flipBtn);

    await waitFor(() => {
      expect(flipMock).toHaveBeenCalled();
    });
  });

  it('onJoin callback passes facingMode in config', async () => {
    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    const joinBtn = screen.getByRole('button', { name: /Join Classroom/i });
    await user.click(joinBtn);

    await waitFor(() => {
      expect(defaultProps.onJoin).toHaveBeenCalled();
    });

    const config = defaultProps.onJoin.mock.calls[0][0];
    expect(config.facingMode).toBeDefined();
  });

  it('passes cameraEnabled=true and micEnabled=true in join config when toggled on', async () => {
    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    // Enable mic and camera
    const micBtn = screen.getByRole('button', { name: /microphone/i });
    const camBtn = screen.getByRole('button', { name: /camera/i });
    await user.click(micBtn);
    await user.click(camBtn);

    const joinBtn = screen.getByRole('button', { name: /Join Classroom/i });
    await user.click(joinBtn);

    await waitFor(() => {
      expect(defaultProps.onJoin).toHaveBeenCalled();
    });

    const config = defaultProps.onJoin.mock.calls[0][0];
    expect(config.micEnabled).toBe(true);
    expect(config.cameraEnabled).toBe(true);
  });

  it('shows error message when camera access fails', async () => {
    mockGUMError = new Error('NotAllowedError');

    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    const camBtn = screen.getByRole('button', { name: /camera/i });
    await user.click(camBtn);

    await waitFor(() => {
      expect(screen.getByText(/Unable to access camera/i)).toBeInTheDocument();
    });
  });

  it('does not pass exact constraints in getUserMedia (avoids OverconstrainedError)', async () => {
    const getVideoConstraints = vi.fn(() => ({ facingMode: 'environment', deviceId: 'cam-back' }));
    (mockUseMediaDevices as any).mockReturnValue({
      videoDevices: [
        { deviceId: 'cam-front', label: 'Front Camera' },
        { deviceId: 'cam-back', label: 'Rear Camera' },
      ],
      audioInputDevices: [{ deviceId: 'mic-1', label: 'Mic' }],
      hasPermission: true,
      enumerate: vi.fn(),
      facingMode: 'environment',
      setFacingMode: vi.fn(),
      selectedCameraId: 'cam-back',
      selectedAudioInputId: 'mic-1',
      getVideoConstraints,
      getAudioConstraints: vi.fn(() => ({})),
      flipCamera: vi.fn(),
    });

    await act(async () => {
      render(<PreJoin {...defaultProps} />);
      await flushPromises();
    });

    const camBtn = screen.getByRole('button', { name: /camera/i });
    await user.click(camBtn);

    await waitFor(() => {
      expect(getVideoConstraints).toHaveBeenCalled();
    });

    const constraints = getVideoConstraints.mock.results[0].value;
    // CRITICAL: must NOT use { exact: ... } — causes OverconstrainedError on mobile
    expect(constraints.facingMode).not.toEqual(expect.objectContaining({ exact: expect.anything() }));
    expect(constraints.deviceId).not.toEqual(expect.objectContaining({ exact: expect.anything() }));
  });
});
