'use client';

import React from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import VideoTile from './VideoTile';

interface FilmstripProps {
  pinnedParticipantSid?: string;
  onPinParticipant?: (sid: string) => void;
  visible?: boolean;
  participants?: any[]; // shard override
}

export default function Filmstrip({
  pinnedParticipantSid,
  onPinParticipant,
  visible = true,
  participants: participantsOverride,
}: FilmstripProps) {
  const rawParticipants = useParticipants();
  const allParticipants = participantsOverride ?? rawParticipants;

  if (!visible || allParticipants.length === 0) return null;

  return (
    <div className="h-24 sm:h-28 bg-edu-slate border-t border-gray-800 flex items-center px-3 sm:px-4 gap-3 overflow-x-auto scrollbar-hide">
      {allParticipants.map((participant) => (
        <VideoTile
          key={participant.sid}
          participant={participant}
          isLocal={false} // local is rendered by FocusLayout MainView
          isPinned={pinnedParticipantSid === participant.sid}
          isMainSpeaker={false}
          onClick={() => onPinParticipant?.(participant.sid)}
          aspect="video"
          className="w-36 sm:w-44 h-20 sm:h-24 flex-shrink-0"
        />
      ))}
    </div>
  );
}
