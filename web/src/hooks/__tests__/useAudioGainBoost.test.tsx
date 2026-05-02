import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { useAudioGainBoost } from '../useAudioGainBoost';

/* ── Proper jsdom-compatible AudioContext mock ── */
class MockAudioContext {
  static _lastInstance: MockAudioContext;

  state = 'running';
  destination = { connect: vi.fn(), disconnect: vi.fn() };

  gainNodes: MockGainNode[] = [];
  sources: MockMediaElementSource[] = [];

  constructor() {
    MockAudioContext._lastInstance = this;
  }

  createGain() {
    const node = new MockGainNode();
    this.gainNodes.push(node);
    return node as any;
  }

  createMediaElementSource(el: HTMLAudioElement) {
    const src = new MockMediaElementSource(el);
    this.sources.push(src);
    return src as any;
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

class MockGainNode {
  gain = { value: 1 };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockMediaElementSource {
  connect = vi.fn();
  disconnect = vi.fn();
  constructor(_el: HTMLAudioElement) {}
}

describe('useAudioGainBoost', () => {
  beforeEach(() => {
    (globalThis as any).AudioContext = MockAudioContext;
  });

  afterEach(() => {
    delete (globalThis as any).AudioContext;
    vi.clearAllMocks();
  });

  // Wrapper that mounts an audio element and calls the hook
  function TestAudio({ enabled, gain }: { enabled: boolean; gain?: number }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    useAudioGainBoost(audioRef, { enabled, gain });
    return <audio ref={audioRef} data-testid="test-audio" />;
  }

  it('does nothing when disabled (enabled=false)', () => {
    const { unmount } = render(<TestAudio enabled={false} gain={5} />);
    // AudioContext should never be constructed
    expect(MockAudioContext._lastInstance?.gainNodes.length ?? 0).toBe(0);
    unmount();
  });

  it('does nothing when gain == 1', () => {
    const { unmount } = render(<TestAudio enabled={true} gain={1} />);
    expect(MockAudioContext._lastInstance?.gainNodes.length ?? 0).toBe(0);
    unmount();
  });

  it('does nothing when gain < 1', () => {
    const { unmount } = render(<TestAudio enabled={true} gain={0.5} />);
    expect(MockAudioContext._lastInstance?.gainNodes.length ?? 0).toBe(0);
    unmount();
  });

  it('creates AudioContext + GainNode + wires graph for enabled=true', async () => {
    render(<TestAudio enabled={true} gain={3.5} />);

    await waitFor(() => {
      const ctx = MockAudioContext._lastInstance;
      expect(ctx.gainNodes.length).toBe(1);
      expect(ctx.sources.length).toBe(1);

      const gainNode = ctx.gainNodes[0];
      expect(gainNode.gain.value).toBe(3.5);

      // source → gainNode, gainNode → ctx.destination
      expect(ctx.sources[0].connect).toHaveBeenCalledWith(gainNode);
      expect(gainNode.connect).toHaveBeenCalledWith(ctx.destination);
    });
  });

  it('uses default gain of 1.8 when gain is omitted', async () => {
    render(<TestAudio enabled={true} />);

    await waitFor(() => {
      expect(MockAudioContext._lastInstance.gainNodes[0].gain.value).toBe(1.8);
    });
  });

  it('cleans up source, gainNode and AudioContext on unmount', async () => {
    const { unmount } = render(<TestAudio enabled={true} gain={2} />);

    await waitFor(() =>
      expect(MockAudioContext._lastInstance.gainNodes.length).toBe(1),
    );

    const ctx = MockAudioContext._lastInstance;
    const spyClose = vi.spyOn(ctx, 'close');

    unmount();

    await waitFor(() => {
      expect(ctx.sources[0].disconnect).toHaveBeenCalled();
      expect(ctx.gainNodes[0].disconnect).toHaveBeenCalled();
      expect(spyClose).toHaveBeenCalled();
    });
  });
});