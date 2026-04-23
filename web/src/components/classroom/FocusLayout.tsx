'use client';

import React from 'react';
import {
  useLocalParticipant,
  useParticipants,
  useIsSpeaking,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { Pin, MicOff } from 'lucide-react';

export type ViewMode = 'focus' | 'grid' | 'immersive';

interface FocusLayoutProps {
  viewMode: ViewMode;
  pinnedParticipantSid?: string;
  onPinParticipant?: (sid: string) => void;
}

/* ─── Name helper ─── */
function getParticipantName(p: Participant): string {
  return p.name || p.identity || 'Unknown';
}

/* ─── Safe participant tile that never crashes ─── */
function SafeParticipantTile({ participant }: { participant: Participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const name = getParticipantName(participant);
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  const cameraPub = participant.getTrackPublication(Track.Source.Camera);
  const isCameraOn =
    !!cameraPub && cameraPub.isSubscribed && !cameraPub.isMuted && !!cameraPub.track;
  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const isMicOn =
    !!micPub && micPub.isSubscribed && !micPub.isMuted;

  React.useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && isCameraOn && cameraPub?.track) {
      cameraPub.track.attach(videoEl);
      return () => {
        cameraPub.track?.detach(videoEl);
      };
    }
  }, [isCameraOn, cameraPub]);

  return (
    <div className="h-full w-full relative">
      {isCameraOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-gray-800/80">
          <div className="w-20 h-20 rounded-full bg-engagio-600 flex items-center justify-center text-white text-3xl font-bold">
            {initials}
          </div>
        </div>
      )}

      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/60 backdrop-blur-sm flex items-center gap-2">
        <span className="text-sm font-medium text-white truncate">{name}</span>
        {!isMicOn && <MicOff className="w-3.5 h-3.5 text-red-400" />}
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/90 rounded text-[10px] text-white font-medium">
          Speaking
        </div>
      )}
    </div>
  );
}

/* ─── Small filmstrip thumbnail item ─── */
function FilmstripItem({
  participant,
  isPinned,
  onClick,
}: {
  participant: Participant;
  isPinned?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-40 sm:w-48 h-24 sm:h-28 rounded-lg overflow-hidden transition-all group bg-gray-900 ${
        'ring-1 ring-gray-700 hover:ring-gray-500'
      } ${isPinned ? 'ring-2 ring-engagio-500' : ''}`}
    >
      <SafeParticipantTile participant={participant} />

      {isPinned && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-engagio-600/90 rounded text-[9px] text-white font-medium flex items-center gap-1">
          <Pin className="w-2.5 h-2.5" />
          PINNED
        </div>
      )}
    </button>
  );
}

/* ─── Large main video tile ─── */
function MainVideo({ participant }: { participant: Participant }) {
  return (
    <div className="h-full rounded-xl overflow-hidden bg-gray-900 ring-1 ring-gray-800">
      <SafeParticipantTile participant={participant} />
    </div>
  );
}

/* ─── Self camera PiP ─── */
function SelfCamera({ participant }: { participant: Participant }) {
  return (
    <div className="absolute bottom-20 right-4 w-56 sm:w-64 h-40 sm:h-44 rounded-xl overflow-hidden shadow-2xl z-30 ring-1 ring-gray-700 bg-gray-900">
      <SafeParticipantTile participant={participant} />
    </div>
  );
}

/* ─── Main layout ─── */
export default function FocusLayout({
  viewMode,
  pinnedParticipantSid,
  onPinParticipant,
}: FocusLayoutProps) {
  const allParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  if (!localParticipant) return null;

  // Exclude local from main stage — self is always in floating PiP
  const remoteParticipants = allParticipants.filter(
    (p) => p.sid !== localParticipant.sid
  );

  // Determine focused participant
  const focusedParticipant = pinnedParticipantSid
    ? remoteParticipants.find((p) => p.sid === pinnedParticipantSid) || null
    : remoteParticipants[0] || null;

  const isImmersive = viewMode === 'immersive';

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* ── Main stage: remote participants only ── */}
      <div className="flex-1 overflow-hidden relative">
        {remoteParticipants.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">👋</div>
              <p className="text-lg font-medium text-gray-300">
                Waiting for others to join…
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Share the session code to invite participants
              </p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid view */
          <div className="h-full p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto scrollbar-hide">
            {remoteParticipants.map((p) => (
              <div
                key={p.sid}
                className="relative rounded-xl overflow-hidden bg-gray-900 cursor-pointer group"
                onClick={() => onPinParticipant?.(p.sid)}
              >
                <SafeParticipantTile participant={p} />
              </div>
            ))}
          </div>
        ) : (
          /* Focus / Immersive: focused large + filmstrip */
          <div className="h-full flex flex-col p-2 gap-2">
            {focusedParticipant && (
              <div className="flex-1 min-h-0 relative">
                <MainVideo participant={focusedParticipant} />
              </div>
            )}

            {/* Filmstrip of other remotes (not in immersive) */}
            {!isImmersive &&
              remoteParticipants.filter(
                (p) => p.sid !== focusedParticipant?.sid
              ).length > 0 && (
                <div className="h-28 flex gap-2 overflow-x-auto scrollbar-hide">
                  {remoteParticipants
                    .filter((p) => p.sid !== focusedParticipant?.sid)
                    .map((p) => (
                      <FilmstripItem
                        key={p.sid}
                        participant={p}
                        isPinned={p.sid === pinnedParticipantSid}
                        onClick={() => onPinParticipant?.(p.sid)}
                      />
                    ))}
                </div>
              )}
          </div>
        )}
      </div>

      {/* ── Floating self camera (PiP) ── */}
      {!isImmersive && <SelfCamera participant={localParticipant} />}
    </div>
  );
}
