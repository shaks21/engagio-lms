'use client';

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  MessageSquare,
  Smile,
  PhoneOff,
  MoreHorizontal,
  PanelRight,
  Pin,
} from 'lucide-react';
import { useRoomContext } from '@livekit/components-react';
import type { Participant } from 'livekit-client';

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
}

function TooltipButton({
  children,
  onClick,
  active = false,
  activeClass = '',
  inactiveClass = '',
  tooltip,
  badge,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  inactiveClass?: string;
  tooltip: string;
  badge?: React.ReactNode;
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      className={`control-btn group relative p-2.5 sm:p-3 rounded-xl transition-all ${
        active ? activeClass : inactiveClass
      }`}
      aria-label={tooltip}
    >
      {children}
      {badge && <span className="absolute -top-1 -right-1">{badge}</span>}
      <span
        className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 transition-opacity whitespace-nowrap pointer-events-none z-50 ${
          showTip ? '!opacity-100' : ''
        }`}
      >
        {tooltip}
      </span>
    </button>
  );
}

export default function Toolbar({
  micMuted,
  cameraOff,
  handRaised,
  screenShareActive,
  unreadChatCount = 0,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleChat,
  onToggleSidebar,
  onLeave,
  onToast,
  onPinLocal,
  isLocalPinned = false,
}: ToolbarProps) {
  return (
    <div className="glass-panel rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 flex items-center gap-1.5 sm:gap-2 shadow-2xl shadow-black/50">
        {/* ── Media Controls ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-3 border-r border-gray-700">
          <TooltipButton
            onClick={() => {
              onToggleMic();
              onToast?.({
                id: Date.now().toString(),
                message: micMuted ? 'Microphone unmuted' : 'Microphone muted',
                type: micMuted ? 'success' : 'warning',
              });
            }}
            active={!micMuted}
            activeClass="bg-green-600 hover:bg-green-700 text-white animate-pulse"
            inactiveClass="bg-edu-danger hover:bg-red-700 text-white"
            tooltip={micMuted ? 'Unmute (Ctrl+D)' : 'Mute (Ctrl+D)'}
          >
            {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </TooltipButton>

          <TooltipButton
            onClick={() => {
              onToggleCamera();
              onToast?.({
                id: Date.now().toString(),
                message: cameraOff ? 'Camera turned on' : 'Camera turned off',
                type: cameraOff ? 'success' : 'warning',
              });
            }}
            active={!cameraOff}
            activeClass="bg-green-600 hover:bg-green-700 text-white animate-pulse"
            inactiveClass="bg-edu-danger hover:bg-red-700 text-white"
            tooltip={cameraOff ? 'Start Video (Ctrl+E)' : 'Stop Video (Ctrl+E)'}
          >
            {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </TooltipButton>

          <TooltipButton
            onClick={onToggleScreenShare}
            active={screenShareActive}
            activeClass="bg-green-600 hover:bg-green-700 text-white"
            inactiveClass="bg-gray-700 hover:bg-gray-600 text-white"
            tooltip="Share Screen"
          >
            <MonitorUp className="w-5 h-5" />
          </TooltipButton>

          {onPinLocal && (
            <TooltipButton
              onClick={onPinLocal}
              active={isLocalPinned}
              activeClass="bg-engagio-600 hover:bg-engagio-700 text-white"
              inactiveClass="bg-gray-700 hover:bg-gray-600 text-white"
              tooltip={isLocalPinned ? 'Unpin Self' : 'Pin Self'}
            >
              <Pin className="w-5 h-5" />
            </TooltipButton>
          )}
        </div>

        {/* ── Engagement Controls ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 border-r border-gray-700">
          <TooltipButton
            onClick={onToggleHandRaise}
            active={handRaised}
            activeClass="bg-yellow-500/20 text-yellow-400"
            inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
            tooltip="Raise Hand (Ctrl+R)"
            badge={
              handRaised ? (
                <span className="w-4 h-4 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  !
                </span>
              ) : undefined
            }
          >
            <Hand className="w-5 h-5" />
          </TooltipButton>

          <TooltipButton
            onClick={onToggleChat}
            active={false}
            inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
            tooltip="Chat"
            badge={
              unreadChatCount > 0 ? (
                <span className="w-4 h-4 min-w-[16px] bg-engagio-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </span>
              ) : undefined
            }
          >
            <MessageSquare className="w-5 h-5" />
          </TooltipButton>

          <TooltipButton
            onClick={() => {}}
            tooltip="Reactions"
            inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
          >
            <Smile className="w-5 h-5" />
          </TooltipButton>
        </div>

        {/* ── Session Controls ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3">
          {onToggleSidebar && (
            <TooltipButton
              onClick={onToggleSidebar}
              tooltip="Toggle Sidebar (Ctrl+B)"
              inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
            >
              <PanelRight className="w-5 h-5" />
            </TooltipButton>
          )}

          <TooltipButton
            onClick={() => {}}
            tooltip="More"
            inactiveClass="hover:bg-gray-700 text-gray-300 hover:text-white"
          >
            <MoreHorizontal className="w-5 h-5" />
          </TooltipButton>

          <button
            onClick={onLeave}
            className="control-btn flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-edu-danger hover:bg-red-700 text-white transition-all ml-1"
            aria-label="Leave"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>
  );
}
