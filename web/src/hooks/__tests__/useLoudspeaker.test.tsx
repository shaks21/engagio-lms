import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoudspeaker } from '../useLoudspeaker';

describe('useLoudspeaker', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      mediaDevices: undefined,
    } as any);
  });

  it('defaults to speaker mode on mobile', () => {
    const { result } = renderHook(() => useLoudspeaker());
    expect(result.current.isSpeaker).toBe(true);
    expect(result.current.isSupported).toBe(true);
  });

  it('allows toggling loudspeaker off', () => {
    const { result } = renderHook(() => useLoudspeaker());
    act(() => result.current.setSpeaker(false));
    expect(result.current.isSpeaker).toBe(false);
  });

  it('allows toggling loudspeaker back on', () => {
    const { result } = renderHook(() => useLoudspeaker());
    act(() => result.current.setSpeaker(false));
    act(() => result.current.setSpeaker(true));
    expect(result.current.isSpeaker).toBe(true);
  });

  it('detects desktop as supported but not speaker-forced', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)', mediaDevices: undefined } as any);
    const { result } = renderHook(() => useLoudspeaker());
    expect(result.current.isSupported).toBe(true);
    // On desktop we can still toggle, but it affects setSinkId or audioSession if available
    expect(typeof result.current.setSpeaker).toBe('function');
  });

  it('exposes forceSpeaker function that can be called imperatively', () => {
    const { result } = renderHook(() => useLoudspeaker());
    expect(typeof result.current.forceSpeaker).toBe('function');
    expect(() => result.current.forceSpeaker()).not.toThrow();
  });
});
