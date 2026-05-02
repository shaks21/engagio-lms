import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLoudspeaker } from '../useLoudspeaker';

describe('useLoudspeaker — Audio SinkID Deep Fix (debug)', () => {
  let mockAudioElements: HTMLAudioElement[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioElements = [];
    (HTMLMediaElement.prototype as any).setSinkId = vi.fn().mockResolvedValue(undefined);

    const createMockAudio = (id: string) => {
      const el = document.createElement('audio');
      el.id = id;
      (el as any).setSinkId = vi.fn().mockResolvedValue(undefined);
      document.body.appendChild(el);
      mockAudioElements.push(el);
      return el;
    };

    createMockAudio('remote-audio-1');
    createMockAudio('remote-audio-2');

    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10)',
      configurable: true,
    });
  });

  afterEach(() => {
    mockAudioElements.forEach((el) => el.remove());
    delete (HTMLMediaElement.prototype as any).setSinkId;
  });

  it('finds audio elements via querySelectorAll', () => {
    const found = document.querySelectorAll('audio');
    expect(found.length).toBe(2);
  });

  it('applies setSinkId to all audio elements', async () => {
    const { result } = renderHook(() => useLoudspeaker());

    act(() => {
      result.current.setSpeaker(true);
    });

    await waitFor(() => {
      mockAudioElements.forEach((el) => {
        expect((el as any).setSinkId).toHaveBeenCalled();
      });
    });
  });
});
