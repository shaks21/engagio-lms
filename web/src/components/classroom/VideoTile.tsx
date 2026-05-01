'use client';

import React from 'react';
import type { Participant } from 'livekit-client';
import { Mic, MicOff, Pin } from 'lucide-react';

interface VideoTileProps {
  participant: Participant;
  isLocal?: boolean;
  isPinned?: boolean;
  isMainSpeaker?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  aspect?: 'video' | 'square';
}

export default function VideoTile({
  participant,
  isLocal = false,
  isPinned = false,
  isMainSpeaker = false,
  onClick,
  className = '',
  style,
  aspect = 'video',
}: VideoTileProps) {
  const isSpeaking = false; // we rely on CSS visual class
  const name = participant.name || participant.identity || 'Unknown';
  const audioMuted = !participant.isMicrophoneEnabled;

  const aspectCls = aspect === 'video' ? 'aspect-video' : 'aspect-square';

  // Placeholder initials when video off
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      onClick={onClick}
      className={`video-tile relative ${aspectCls} bg-gray-900 rounded-xl overflow-hidden cursor-pointer group ${
        isSpeaking ? 'speaking-ring' : 'ring-1 ring-gray-700/50'
      } ${className}`}
      style={style}
    >
      {/* Video background will be injected by LiveKit parent (VideoConference or similar) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-engagio-800 flex items-center justify-center text-xl font-bold text-white">
          {initials}
        </div>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-green-500/20 text-green-400 text-[11px] font-medium rounded-full border border-green-500/30 flex items-center gap-1.5 pointer-events-none">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          {!isMainSpeaker && <span>Speaking</span>}
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
            {audioMuted ? (
              <MicOff className="w-3 h-3 text-edu-danger" />
            ) : (
              <Mic className="w-3 h-3 text-white" />
            )}
          </div>
          <span className="text-[13px] font-medium text-white drop-shadow-md truncate max-w-[8rem]">
            {name} {isLocal ? '(You)' : ''}
          </span>
        </div>

        {isPinned && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-engagio-600/80 rounded-md text-[10px] text-white font-medium">
            <Pin className="w-3 h-3" />
            Pinned
          </div>
        )}
      </div>
    </div>
  );
}
