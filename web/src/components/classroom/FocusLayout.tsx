'use client';

import React, { useState, useEffect } from 'react';
import {
  useLocalParticipant,
  useParticipants,
  useIsSpeaking,
} from '@livekit/components-react';
import { VideoConference } from '@livekit/components-react';
import type { Participant } from 'livekit-client';

export type ViewMode = 'focus' | 'grid' | 'immersive';

interface FocusLayoutProps {
  viewMode: ViewMode;
  pinnedParticipantSid?: string;
  onPinParticipant?: (sid: string) => void;
}

function FilmstripTile({
  participant,
  isLocal,
  isPinned,
  onClick,
}: {
  participant: Participant;
  isLocal: boolean;
  isPinned?: boolean;
  onClick?: () => void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const name = participant.identity || participant.name || 'Unknown';

  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-36 sm:w-44 h-20 sm:h-24 rounded-lg overflow-hidden transition-all group ${
        isSpeaking
          ? 'speaking-ring'
          : 'ring-1 ring-gray-700 hover:ring-gray-600'
      } ${isPinned ? 'ring-2 ring-engagio-500' : ''}`}
    >
      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-engagio-700 flex items-center justify-center text-sm font-bold text-white">
          {name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      <div className="absolute bottom-1.5 left-2 z-10 flex items-center gap-1.5">
        <span className="text-[11px] text-white font-medium drop-shadow">
          {name} {isLocal && <span className="text-gray-400">(You)</span>}
        </span>
      </div>

      {isPinned && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-engagio-600/90 rounded text-[9px] text-white font-medium">
          PINNED
        </div>
      )}
    </button>
  );
}

export default function FocusLayout({
  viewMode,
  pinnedParticipantSid,
  onPinParticipant,
}: FocusLayoutProps) {
  const allParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const participants = allParticipants;
  const mainSpeaker = pinnedParticipantSid
    ? participants.find((p) => p.sid === pinnedParticipantSid) || localParticipant
    : participants.find((p) => (p as any).isSpeaking) || localParticipant;

  const others = participants.filter(
    (p) => mainSpeaker && p.sid !== mainSpeaker.sid
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* LiveKit renders all tracks inside this container */}
      <div className="flex-1 relative overflow-hidden">
        <VideoConference />
      </div>

      {/* Filmstrip overlay at bottom */}
      {viewMode !== 'immersive' && others.length > 0 && (
        <div className="h-24 sm:h-28 bg-edu-slate border-t border-gray-800 flex items-center px-3 sm:px-4 gap-3 overflow-x-auto scrollbar-hide z-10">
          {others.map((participant) => (
            <FilmstripTile
              key={participant.sid}
              participant={participant}
              isLocal={participant.sid === localParticipant?.sid}
              isPinned={participant.sid === pinnedParticipantSid}
              onClick={() => onPinParticipant?.(participant.sid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
