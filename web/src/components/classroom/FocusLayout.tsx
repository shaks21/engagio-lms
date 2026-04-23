'use client';

import React from 'react';
import {
  useLocalParticipant,
  useParticipants,
  ParticipantContext,
  ParticipantTile,
  useIsSpeaking,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Pin } from 'lucide-react';

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
  const isSpeaking = useIsSpeaking(participant);
  const name = getParticipantName(participant);
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 w-40 sm:w-48 h-24 sm:h-28 rounded-lg overflow-hidden transition-all group bg-gray-900 ${
        isSpeaking
          ? 'speaking-ring'
          : 'ring-1 ring-gray-700 hover:ring-gray-500'
      } ${isPinned ? 'ring-2 ring-engagio-500' : ''}`}
    >
      <ParticipantContext.Provider value={participant}>
        <ParticipantTile />
      </ParticipantContext.Provider>

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
      <ParticipantContext.Provider value={participant}>
        <ParticipantTile />
      </ParticipantContext.Provider>
    </div>
  );
}

/* ─── Self camera PiP ─── */
function SelfCamera({ participant }: { participant: Participant }) {
  return (
    <div className="absolute bottom-20 right-4 w-56 sm:w-64 h-40 sm:h-44 rounded-xl overflow-hidden shadow-2xl z-30 ring-1 ring-gray-700 bg-gray-900">
      <ParticipantContext.Provider value={participant}>
        <ParticipantTile />
      </ParticipantContext.Provider>
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
                <ParticipantContext.Provider value={p}>
                  <ParticipantTile />
                </ParticipantContext.Provider>
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
