'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, Hand, MessageSquare,
  Smile, PhoneOff, MoreHorizontal, PanelRight, Pin,
  Settings as SettingsIcon, X, Grid3x3, Focus, Maximize, LogOut, Volume2, VolumeOff,
} from 'lucide-react';
import { useLoudspeaker } from '@/hooks/useLoudspeaker';

export interface Toast {
  id: string;
  message: string;
  icon?: React.ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ToolbarProps {
  micMuted: boolean;
  cameraOff: boolean;
  handRaised: boolean;
  screenShareActive: boolean;
  unreadChatCount: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleChat: () => void;
  onToggleSidebar?: () => void;
  onLeave: () => void;
  onToast?: (toast: Toast) => void;
  onPinLocal?: () => void;
  isLocalPinned?: boolean;
  viewMode?: 'focus' | 'grid' | 'immersive';
  onViewModeChange?: (mode: 'focus' | 'grid' | 'immersive') => void;
  room?: any;
  canPresent?: boolean;
}

function TooltipButton({
  children, onClick, active = false, activeClass = '', inactiveClass = '',
  tooltip, badge, flash = false, disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  inactiveClass?: string;
  tooltip: string;
  badge?: React.ReactNode;
  flash?: boolean;
  disabled?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      className={`control-btn group relative p-2.5 sm:p-3 rounded-xl transition-all ${
        flash ? 'animate-btn-flash' : ''
      } ${active ? activeClass : `${inactiveClass} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}`}
      aria-label={tooltip}
    >
      {children}
      {badge && <span className="absolute -top-1 -right-1">{badge}</span>}
      <span className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
        showTip ? '!opacity-100' : ''
      }`}>
        {tooltip}
      </span>
    </button>
  );
}

/* ─── More Options Menu (3 dots) ─── */
function MoreMenu({
  viewMode, onViewModeChange, onLeave,
}: {
  viewMode?: 'focus' | 'grid' | 'immersive';
  onViewModeChange?: (mode: 'focus' | 'grid' | 'immersive') => void;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, []);

  const viewModes = [
    { mode: 'focus' as const, label: 'Focus View', Icon: Focus },
    { mode: 'grid' as const, label: 'Grid View', Icon: Grid3x3 },
    { mode: 'immersive' as const, label: 'Immersive', Icon: Maximize },
  ];

  return (
    <div ref={ref} className="relative">
      <TooltipButton
        onClick={() => setOpen(!open)}
        tooltip="More"
        inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
      >
        <MoreHorizontal className="w-5 h-5" />
      </TooltipButton>

      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl p-2 min-w-[200px] z-[70]">
          {onViewModeChange && (<>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2 py-1">Layout</p>
            {viewModes.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                onClick={() => { onViewModeChange(mode); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  viewMode === mode ? 'bg-engagio-600/20 text-engagio-400' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
            <div className="border-t border-gray-800 my-1" />
          </>)}
          <button
            onClick={() => { setOpen(false); onLeave(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Leave Session
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Loudspeaker Quick Toggle Button ─── */
function LoudspeakerButton() {
  const { isSpeaker, setSpeaker } = useLoudspeaker();
  return (
    <TooltipButton
      onClick={() => {
        try { setSpeaker(!isSpeaker); } catch (e) { console.warn('[Loudspeaker] Toggle failed:', e); }
      }}
      active={isSpeaker}
      activeClass="bg-engagio-600 hover:bg-engagio-700 text-white ring-2 ring-engagio-400/50"
      inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
      tooltip={isSpeaker ? 'Loudspeaker on' : 'Earpiece mode'}
    >
      {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeOff className="w-5 h-5" />}
    </TooltipButton>
  );
}

/* ─── Settings Dialog ─── */
function SettingsDialog({
  open, onClose, room,
}: {
  open: boolean;
  onClose: () => void;
  room?: any;
}) {
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(true);
  const { isSpeaker, setSpeaker } = useLoudspeaker();

  // Enumerate real audio output devices
  useEffect(() => {
    if (!open) return;
    if (!navigator.mediaDevices?.enumerateDevices) {
      setAudioOutputs([]);
      return;
    }
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioOutputs(outputs);
      if (outputs.length > 0 && !selectedOutputId) {
        setSelectedOutputId(outputs[0].deviceId);
      }
    }).catch(() => {
      setAudioOutputs([]);
    });
  }, [open, selectedOutputId]);

  const handleSwitchCamera = useCallback(async (facing: 'user' | 'environment') => {
    setCameraFacing(facing);
    if (!room?.switchActiveDevice) return;
    try {
      await room.switchActiveDevice('videoinput', undefined, true, { facingMode: facing });
    } catch (e) {
      console.warn('[Settings] Camera switch not supported in this browser:', e);
    }
  }, [room]);

  const handleSwitchAudioOutput = useCallback(async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    if (!room?.switchActiveDevice) return;
    try {
      await room.switchActiveDevice('audiooutput', deviceId);
    } catch (e) {
      console.warn('[Settings] Audio output switch not supported:', e);
    }
  }, [room]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-engagio-400" />
            Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Camera Facing */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Camera</label>
            <div className="flex gap-2 mt-2">
              {(['user', 'environment'] as const).map((facing) => (
                <button
                  key={facing}
                  onClick={() => handleSwitchCamera(facing)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    cameraFacing === facing ? 'bg-engagio-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {facing === 'user' ? '📷 Front' : '📸 Rear'}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Output (real devices) */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider font-medium">Audio Output</label>
            {audioOutputs.length === 0 ? (
              <p className="text-xs text-gray-500 mt-2">Your browser does not support audio output switching.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mt-2">
                {audioOutputs.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => handleSwitchAudioOutput(device.deviceId)}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors text-left ${
                      selectedOutputId === device.deviceId
                        ? 'bg-engagio-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-base">{
                      device.label.toLowerCase().includes('headphone') ||
                      device.label.toLowerCase().includes('headset') ||
                      device.label.toLowerCase().includes('earphone')
                        ? '🎧'
                        : '🔊'
                    }</span>
                    <span className="truncate">{device.label || 'Unknown Device'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Loudspeaker Toggle in Settings */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Loudspeaker</p>
              <p className="text-xs text-gray-500">Route audio to phone speaker (mobile)</p>
            </div>
            <button
              onClick={() => setSpeaker(!isSpeaker)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isSpeaker ? 'bg-engagio-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {isSpeaker ? '🔊 Speaker' : '🎧 Earpiece'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Notifications</p>
              <p className="text-xs text-gray-500">Receive toast alerts</p>
            </div>
            <button
              onClick={() => setNotifications((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                notifications ? 'bg-engagio-600' : 'bg-gray-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                notifications ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-800">
          <button onClick={onClose}
            className="w-full py-2.5 bg-engagio-600 hover:bg-engagio-700 text-white font-medium rounded-lg transition-colors cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Toolbar({
  micMuted, cameraOff, handRaised, screenShareActive, unreadChatCount = 0,
  onToggleMic, onToggleCamera, onToggleScreenShare, onToggleHandRaise,
  onToggleChat, onToggleSidebar, onLeave, onToast, onPinLocal,
  isLocalPinned, viewMode, onViewModeChange, canPresent, room,
}: ToolbarProps) {
  const micFlashing = !micMuted;
  const camFlashing = !cameraOff;
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (<>
    <div className="glass-panel rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 flex items-center gap-1.5 sm:gap-2 shadow-2xl shadow-black/50">
      {/* Media Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-3 border-r border-gray-700">
        <TooltipButton
          onClick={() => {
            onToggleMic();
            onToast?.({ id: Date.now().toString(), message: micMuted ? 'Microphone unmuted' : 'Microphone muted', type: micMuted ? 'success' : 'warning' });
          }}
          active={!micMuted} flash={micFlashing}
          activeClass="bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400/50"
          inactiveClass="bg-edu-danger hover:bg-red-700 text-white"
          tooltip={micMuted ? 'Unmute (Ctrl+D)' : 'Mute (Ctrl+D)'}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </TooltipButton>

        <TooltipButton
          onClick={() => {
            onToggleCamera();
            onToast?.({ id: Date.now().toString(), message: cameraOff ? 'Camera turned on' : 'Camera turned off', type: cameraOff ? 'success' : 'warning' });
          }}
          active={!cameraOff} flash={camFlashing}
          activeClass="bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400/50"
          inactiveClass="bg-edu-danger hover:bg-red-700 text-white"
          tooltip={cameraOff ? 'Start Video (Ctrl+E)' : 'Stop Video (Ctrl+E)'}
        >
          {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </TooltipButton>

        <TooltipButton onClick={onToggleScreenShare} active={screenShareActive} flash={screenShareActive}
          activeClass="bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400/50"
          inactiveClass={`bg-gray-700 hover:bg-gray-600 text-white ${canPresent === false ? 'opacity-40 cursor-not-allowed' : ''}`}
          tooltip={canPresent === false ? 'Screen sharing only available in breakout rooms' : 'Share Screen'}
          disabled={canPresent === false}
        >
          <MonitorUp className="w-5 h-5" />
        </TooltipButton>

        {onPinLocal && (
          <TooltipButton onClick={onPinLocal} active={isLocalPinned}
            activeClass="bg-engagio-600 hover:bg-engagio-700 text-white"
            inactiveClass="bg-gray-700 hover:bg-gray-600 text-white"
            tooltip={isLocalPinned ? 'Unpin Self' : 'Pin Self'}
          >
            <Pin className="w-5 h-5" />
          </TooltipButton>
        )}
      </div>

      {/* Engagement Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 border-r border-gray-700">
        <TooltipButton onClick={onToggleHandRaise} active={handRaised}
          activeClass="bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-400/50"
          inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
          tooltip="Raise Hand (Ctrl+R)"
          badge={handRaised ? (
            <span className="w-4 h-4 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">!</span>
          ) : undefined}
        >
          <Hand className="w-5 h-5" />
        </TooltipButton>

        <TooltipButton onClick={onToggleChat} active={false}
          inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white" tooltip="Chat"
          badge={unreadChatCount > 0 ? (
            <span className="w-4 h-4 min-w-[16px] bg-engagio-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          ) : undefined}
        >
          <MessageSquare className="w-5 h-5" />
        </TooltipButton>

        <TooltipButton onClick={() => onToast?.({ id: Date.now().toString(), message: 'Reactions coming soon!', type: 'info' })}
          tooltip="Reactions" inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
        >
          <Smile className="w-5 h-5" />
        </TooltipButton>
      </div>

      {/* Session Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3">
        {onToggleSidebar && (
          <TooltipButton onClick={onToggleSidebar} tooltip="Toggle Sidebar (Ctrl+B)"
            inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
          >
            <PanelRight className="w-5 h-5" />
          </TooltipButton>
        )}

        <LoudspeakerButton />

        <TooltipButton
          data-testid="settings-btn"
          onClick={() => setSettingsOpen(true)} tooltip="Settings"
          inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
        >
          <SettingsIcon className="w-5 h-5" />
        </TooltipButton>

        <MoreMenu viewMode={viewMode} onViewModeChange={onViewModeChange} onLeave={onLeave} />

        <button onClick={onLeave}
          className="control-btn flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-edu-danger hover:bg-red-700 text-white transition-all ml-1"
          aria-label="Leave"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>

    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} room={room} />
  </>);
}
