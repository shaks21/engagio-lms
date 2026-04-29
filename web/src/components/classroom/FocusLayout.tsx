'use client';

import React from 'react';
import {
  useLocalParticipant,
  useParticipants,
  useIsSpeaking,
} from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { Pin, MicOff, Monitor, Minus } from 'lucide-react';

export type ViewMode = 'focus' | 'grid' | 'immersive';

interface FocusLayoutProps {
  viewMode: ViewMode;
  pinnedParticipantSid?: string;
  onPinParticipant?: (sid: string) => void;
  isTeacher?: boolean;
  shardLabel?: string; // e.g. "Breakout Room: room-a"
}

/* ─── Name helper ─── */
function getParticipantName(p: Participant): string {
  return p.name || p.identity || 'Unknown';
}

function getBreakoutRoomId(p: Participant): string | null {
  try {
    const meta = JSON.parse(p.metadata || '{}');
    return meta.breakoutRoomId || null;
  } catch {
    return null;
  }
}

/* ─── Safe participant tile that never crashes ─── */
interface SafeParticipantTileProps {
  participant: Participant;
  trackSource?: Track.Source;
  screenShare?: boolean;
}

function SafeParticipantTile({
  participant,
  trackSource = Track.Source.Camera,
  screenShare,
}: SafeParticipantTileProps) {
  const isSpeaking = useIsSpeaking(participant);
  const name = getParticipantName(participant);
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  const videoPub = participant.getTrackPublication(trackSource);
  // FIX: local tracks are not "subscribed" — use isEnabled for local
  const isVideoOn =
    !!videoPub &&
    (participant.isLocal ? videoPub.isEnabled : videoPub.isSubscribed) &&
    !videoPub.isMuted &&
    !!videoPub.track;
  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  // For local: audio track may be enabled even if not "subscribed" to ourselves
  // For remote: check both subscribed AND has actual track
  const isMicOn =
    !!micPub &&
    (participant.isLocal ? (micPub.isEnabled && !!micPub.track) : micPub.isSubscribed && !micPub.isMuted);

  // Audio ref
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && isVideoOn && videoPub?.track) {
      videoPub.track.attach(videoEl);
      return () => {
        videoPub.track?.detach(videoEl);
      };
    }
  }, [isVideoOn, videoPub]);

  // Attach audio track separately for proper audio playback
  React.useEffect(() => {
    const audioEl = audioRef.current;
    const audioTrack = micPub?.track;
    if (audioEl && audioTrack && !participant.isLocal) {
      audioTrack.attach(audioEl);
      audioEl.muted = false;
      audioEl.play().catch(() => {});
      return () => {
        audioTrack?.detach(audioEl);
      };
    } else if (audioEl && !audioTrack && !participant.isLocal) {
      audioEl.srcObject = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micPub?.track, participant.isLocal]);

  return (
    <div className="h-full w-full relative">
      {/* Hidden audio element for proper remote audio playback */}
      <audio ref={audioRef} autoPlay playsInline muted={participant.isLocal} />
      {isVideoOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`h-full w-full ${screenShare ? 'object-contain' : 'object-cover'}`}
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

      {/* Speaking indicator (camera only) */}
      {isSpeaking && trackSource === Track.Source.Camera && (
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
function MainVideo({
  participant,
  isScreenShare,
}: {
  participant: Participant;
  isScreenShare?: boolean;
}) {
  return (
    <div className="h-full rounded-xl overflow-hidden bg-gray-900 ring-1 ring-gray-800 relative">
      <SafeParticipantTile
        participant={participant}
        trackSource={
          isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera
        }
        screenShare={isScreenShare}
      />

      {isScreenShare && (
        <div className="absolute top-3 left-3 px-2.5 py-1 bg-red-600/90 rounded-md text-xs text-white font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
          <Monitor className="w-3.5 h-3.5" />
          Screen sharing
        </div>
      )}
    </div>
  );
}

/* ─── Draggable self-camera PiP ─── */

interface DraggablePiPState {
  minimized: boolean;
  offset: { x: number; y: number };
  dragging: boolean;
}

function dragReducer(state: DraggablePiPState, action: Partial<DraggablePiPState>): DraggablePiPState {
  return { ...state, ...action };
}

function DraggableSelfPiP({
  participant,
  onClickPinSelf,
}: {
  participant: Participant;
  onClickPinSelf: () => void;
}) {
  const [state, dispatch] = React.useReducer(dragReducer, {
    minimized: false,
    offset: { x: 0, y: 0 },
    dragging: false,
  });
  const { minimized, offset, dragging } = state;

  const dragData = React.useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const containerRef = React.useRef<HTMLDivElement>(null);

  /* Window-level drag listeners */
  React.useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragData.current.startX;
      const dy = e.clientY - dragData.current.startY;

      const el = containerRef.current;
      const parent = el?.offsetParent as HTMLElement | null;
      if (!el || !parent) return;

      const maxX = parent.clientWidth - el.offsetWidth;
      const maxY = parent.clientHeight - el.offsetHeight;

      let newX = dragData.current.initialX + dx;
      let newY = dragData.current.initialY + dy;

      newX = Math.max(-el.offsetLeft, Math.min(newX, maxX - el.offsetLeft));
      newY = Math.max(-el.offsetTop, Math.min(newY, maxY - el.offsetTop));

      dispatch({ offset: { x: newX, y: newY } });
    };

    window.addEventListener('mousemove', handleMove);
    const handleUp = () => dispatch({ dragging: false });
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    dragData.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: offset.x,
      initialY: offset.y,
    };
    dispatch({ dragging: true });
  };

  const handleClick = () => {
    if (dragging) return;
    if (minimized) {
      dispatch({ minimized: false });
    } else {
      onClickPinSelf();
    }
  };

  const name = getParticipantName(participant);
  const initials = name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (minimized) {
    return (
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        className="absolute bottom-32 sm:bottom-20 right-3 sm:right-4 z-30 rounded-full
                   bg-engagio-600 text-white font-bold text-sm shadow-lg
                   ring-2 ring-white/20 hover:ring-white/40 cursor-pointer
                   select-none flex items-center justify-center w-12 h-12"
        title="Click to restore"
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className={`absolute bottom-32 sm:bottom-20 right-3 sm:right-4 w-48 h-32 sm:w-56 sm:h-40
                   rounded-xl overflow-hidden shadow-2xl z-30 ring-1 ring-gray-700 bg-gray-900
                   select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <SafeParticipantTile participant={participant} />

      {/* Minimize button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dispatch({ minimized: true });
        }}
        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-md text-white transition-colors"
        title="Minimize"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Main layout ─── */
export default function FocusLayout({
  viewMode,
  pinnedParticipantSid,
  onPinParticipant,
  isTeacher = false,
  shardLabel,
}: FocusLayoutProps) {
  const allParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  if (!localParticipant) return null;

  const myRoomId = getBreakoutRoomId(localParticipant);

  const remoteParticipants = allParticipants.filter((p) => {
    if (p.sid === localParticipant.sid) return false;
    if (p.isLocal) return false;
    const theirRoomId = getBreakoutRoomId(p);
    const sameRoom = myRoomId === theirRoomId;
    const bothUnassigned = !myRoomId && !theirRoomId;
    // TEACHER: default to same room (main room). Control-View modal shows other rooms.
    if (isTeacher) return sameRoom || bothUnassigned;
    // STUDENT: only peers in the same breakout room.
    return sameRoom || bothUnassigned;
  });

  /* Detect active screen-share */
  const screenSharingParticipant = React.useMemo(() => {
    return (
      allParticipants.find((p) => {
        const pub = p.getTrackPublication(Track.Source.ScreenShare);
        return !!pub && pub.isSubscribed && !pub.isMuted && !!pub.track;
      }) || null
    );
  }, [allParticipants]);

  /* Focus priority: pinned > screen share > first remote > null */
  const focusedParticipant = React.useMemo(() => {
    if (pinnedParticipantSid) {
      return (
        allParticipants.find((p) => p.sid === pinnedParticipantSid) || null
      );
    }
    if (screenSharingParticipant) {
      return screenSharingParticipant;
    }
    return remoteParticipants[0] || null;
  }, [pinnedParticipantSid, allParticipants, screenSharingParticipant, remoteParticipants]);

  const isImmersive = viewMode === 'immersive';
  const isScreenShareFocused =
    !!focusedParticipant &&
    !!screenSharingParticipant &&
    focusedParticipant.sid === screenSharingParticipant.sid;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="px-3 py-1.5 bg-gray-800/70 border-b border-gray-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-engagio-500 animate-pulse" />
          <span className="text-xs font-semibold text-engagio-400">Room: {shardLabel && shardLabel !== 'main' ? shardLabel : 'Main Room'}</span>
        </div>
      </div>
      {/* ── Main stage ── */}
      <div className="flex-1 overflow-hidden relative">
        {remoteParticipants.length === 0 && !focusedParticipant ? (
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
                <MainVideo
                  participant={focusedParticipant}
                  isScreenShare={isScreenShareFocused}
                />
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

      {/* ── Floating self-camera PiP ── */}
      {!isImmersive && (
        <DraggableSelfPiP
          participant={localParticipant}
          onClickPinSelf={() => onPinParticipant?.(localParticipant.sid)}
        />
      )}
    </div>
  );
}
