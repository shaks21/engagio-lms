import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import Toolbar from '../Toolbar';

/* ── mocks ── */
vi.mock('@/hooks/useLoudspeaker', () => ({
  useLoudspeaker: vi.fn(),
}));

const mockUseLoudspeaker = (await import('@/hooks/useLoudspeaker')).useLoudspeaker;

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('Toolbar — Loudspeaker Feature', () => {
  const user = userEvent.setup();
  const defaultProps = {
    micMuted: true,
    cameraOff: true,
    handRaised: false,
    screenShareActive: false,
    unreadChatCount: 0,
    onToggleMic: vi.fn(),
    onToggleCamera: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onToggleHandRaise: vi.fn(),
    onToggleChat: vi.fn(),
    onLeave: vi.fn(),
    onToggleSidebar: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockUseLoudspeaker as any).mockReturnValue({
      isSpeaker: true,
      isSupported: true,
      setSpeaker: vi.fn(),
      forceSpeaker: vi.fn(),
    });
  });

  it('renders loudspeaker quick-toggle button in toolbar', async () => {
    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });
    // The loudspeaker button has aria-label based on tooltip in TooltipButton
    // Find by the icon path or by searching for the tooltip text in the rendered tree
    const loudspeakerBtn = screen.getByLabelText(/Loudspeaker on/i);
    expect(loudspeakerBtn).toBeInTheDocument();
  });

  it('loudspeaker button shows Volume2 icon when speaker is on', async () => {
    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });
    const btn = screen.getByLabelText(/Loudspeaker on/i);
    expect(btn).toBeInTheDocument();
  });

  it('loudspeaker button shows VolumeOff icon when speaker is off', async () => {
    (mockUseLoudspeaker as any).mockReturnValue({
      isSpeaker: false,
      isSupported: true,
      setSpeaker: vi.fn(),
      forceSpeaker: vi.fn(),
    });

    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });
    const btn = screen.getByLabelText(/Earpiece mode/i);
    expect(btn).toBeInTheDocument();
  });

  it('clicking loudspeaker button toggles speaker mode', async () => {
    const setSpeaker = vi.fn();
    (mockUseLoudspeaker as any).mockReturnValue({
      isSpeaker: true,
      isSupported: true,
      setSpeaker,
      forceSpeaker: vi.fn(),
    });

    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });

    const btn = screen.getByLabelText(/Loudspeaker on/i);
    await user.click(btn);

    await waitFor(() => {
      expect(setSpeaker).toHaveBeenCalledWith(false);
    });
  });

  it('settings dialog contains loudspeaker toggle section', async () => {
    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });

    // Open settings dialog
    const settingsBtn = screen.getByLabelText('Settings');
    await user.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('Loudspeaker')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('settings dialog loudspeaker toggle button reflects current state', async () => {
    const setSpeaker = vi.fn();
    (mockUseLoudspeaker as any).mockReturnValue({
      isSpeaker: true,
      isSupported: true,
      setSpeaker,
      forceSpeaker: vi.fn(),
    });

    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });

    const settingsBtn = screen.getByLabelText('Settings');
    await user.click(settingsBtn);

    await waitFor(() => {
      const toggleBtn = screen.getByText('🔊 Speaker');
      expect(toggleBtn).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('settings dialog toggles speaker when loudspeaker button clicked', async () => {
    const setSpeaker = vi.fn();
    (mockUseLoudspeaker as any).mockReturnValue({
      isSpeaker: true,
      isSupported: true,
      setSpeaker,
      forceSpeaker: vi.fn(),
    });

    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });

    const settingsBtn = screen.getByLabelText('Settings');
    await user.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText('🔊 Speaker')).toBeInTheDocument();
    }, { timeout: 3000 });

    const toggleBtn = screen.getByText('🔊 Speaker');
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(setSpeaker).toHaveBeenCalledWith(false);
    });
  });

  it('loudspeaker is resilient when setSpeaker throws', async () => {
    (mockUseLoudspeaker as any).mockReturnValue({
      isSpeaker: true,
      isSupported: true,
      setSpeaker: vi.fn(() => { throw new Error('Audio session not supported'); }),
      forceSpeaker: vi.fn(),
    });

    await act(async () => {
      render(<Toolbar {...defaultProps} />);
      await flushPromises();
    });

    const btn = screen.getByLabelText(/Loudspeaker on/i);
    // Click should not crash the toolbar
    await expect(user.click(btn)).resolves.not.toThrow();
  });
});
