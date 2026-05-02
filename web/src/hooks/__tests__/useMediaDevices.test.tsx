import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMediaDevices } from '../useMediaDevices';

/* ── jsdom navigator.mediaDevices mock ── */
function fakeDevice(kind: string, label: string, deviceId: string): MediaDeviceInfo {
  return {
    kind: kind as any,
    label,
    deviceId,
    groupId: 'group-' + deviceId,
    toJSON: () => ({}),
  } as MediaDeviceInfo;
}

describe('useMediaDevices', () => {
  const allDevices = [
    fakeDevice('videoinput', 'FaceTime HD Camera', 'cam-front'),
    fakeDevice('videoinput', 'Rear Ultra Wide', 'cam-back'),
    fakeDevice('audioinput', 'Built-in Microphone', 'mic-built'),
    fakeDevice('audiooutput', 'Built-in Speakers', 'spk-1'),
    fakeDevice('audiooutput', 'USB Headphones', 'hp-1'),
  ];

  beforeEach(() => {
    const gUM = vi.fn(() => Promise.resolve({ getTracks: () => [] } as any));
    const enumDevices = vi.fn(() => Promise.resolve(allDevices));

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: gUM,
        enumerateDevices: enumDevices,
      },
      configurable: true,
    });

    localStorage.clear();
  });

  async function enumerate(result: any) {
    await act(async () => {
      await result.current.enumerate();
    });
  }

  it('loads and categorizes devices after calling enumerate', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    expect(result.current.videoDevices.map((d: any) => d.deviceId)).toEqual(['cam-front', 'cam-back']);
    expect(result.current.audioInputDevices.map((d: any) => d.deviceId)).toEqual(['mic-built']);
    expect(result.current.audioOutputDevices.map((d: any) => d.deviceId)).toEqual(['spk-1', 'hp-1']);
    expect(result.current.loading).toBe(false);
  });

  it('auto-selects front camera + first input + first output', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    expect(result.current.selectedCameraId).toBe('cam-front'); // label matches /front/
    expect(result.current.selectedAudioInputId).toBe('mic-built');
    expect(result.current.selectedAudioOutputId).toBe('spk-1'); // label matches /speaker/
  });

  it('allows changing camera selection', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    act(() => result.current.setSelectedCameraId('cam-back'));
    expect(result.current.selectedCameraId).toBe('cam-back');
  });

  it('allows changing audio output selection', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    act(() => result.current.setSelectedAudioOutputId('hp-1'));
    expect(result.current.selectedAudioOutputId).toBe('hp-1');
  });

  it('allows toggling facingMode', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    expect(result.current.facingMode).toBe('user'); // default
    act(() => result.current.setFacingMode('environment'));
    expect(result.current.facingMode).toBe('environment');
  });

  it('handles enumerateDevices failure gracefully', async () => {
    (globalThis.navigator.mediaDevices as any).enumerateDevices = vi.fn(() =>
      Promise.reject(new Error('Enumeration failed')),
    );

    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    expect(result.current.videoDevices).toEqual([]);
    expect(result.current.audioInputDevices).toEqual([]);
    expect(result.current.audioOutputDevices).toEqual([]);
  });

  it('builds correct video constraints including facingMode', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);
    act(() => result.current.setFacingMode('environment'));
    act(() => result.current.setSelectedCameraId('cam-back'));

    const constraints = result.current.getVideoConstraints();
    expect(constraints).toEqual({
      facingMode: { exact: 'environment' },
      deviceId: { exact: 'cam-back' },
    });
  });

  it('builds correct audio constraints with ideal processing flags', async () => {
    const { result } = renderHook(() => useMediaDevices());
    await enumerate(result);

    const constraints = result.current.getAudioConstraints();
    expect(constraints).toMatchObject({
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      sampleRate: { ideal: 48000 },
      channelCount: { ideal: 2 },
    });
  });

  it('guesses output type from label', async () => {
    const { result } = renderHook(() => useMediaDevices());
    expect(result.current.guessOutputType('Built-in Speakers')).toBe('speaker');
    expect(result.current.guessOutputType('USB Headphones')).toBe('headset');
    expect(result.current.guessOutputType('Unknown Device')).toBe('default');
  });
});