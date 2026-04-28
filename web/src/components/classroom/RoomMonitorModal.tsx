'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { X, Headphones } from 'lucide-react';
import { useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';

interface MonitorModalProps {
  roomCode: string;
  onClose: () => void;
}

function MonitoredParticipantTile({ identity }: { identity: string }) {
  const participants = useParticipants();
  const participant = useMemo(
    () => participants.find((p) => p.identity === identity),
    [participants, identity]
  );
  const isMuted = !participant?.isMicrophoneEnabled;

  const videoPub = participant?.getTrackPublication(Track.Source.Camera);
  const videoTrack = videoPub?.track;
  const audioPub = participant?.getTrackPublication(Track.Source.Microphone);
  const audioTrack = audioPub?.track;

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    const el = videoRef.current;
    if (el && videoTrack) {
      videoTrack.attach(el);
      return () => { videoTrack?.detach(el); };
    }
  }, [videoTrack]);

  React.useEffect(() => {
    const el = audioRef.current;
    if (el && audioTrack && !participant?.isLocal) {
      audioTrack.attach(el);
      el.muted = false;
      el.play().catch(() => {});
      return () => { audioTrack?.detach(el); };
    }
  }, [audioTrack, participant?.isLocal]);

  if (!participant) return null;

  const name = participant.name || participant.identity;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isVideoOn =
    !!videoPub &&
    (participant.isLocal ? videoPub.isEnabled : videoPub.isSubscribed) &&
    !videoPub.isMuted &&
    !!videoTrack;

  return (
    <div
      className={`relative bg-gray-800 rounded-lg overflow-hidden border ${
        participant.isSpeaking ? 'border-green-500/50 ring-1 ring-green-500/30' : 'border-gray-700/50'
      }`}
    >
      <div className="aspect-video bg-gray-900 relative">
        {isVideoOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isLocal}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300">
              {initials}
            </div>
          </div>
        )}
        {!participant.isLocal && (
          <audio ref={audioRef} autoPlay playsInline muted={participant.isLocal} />
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-green-500'}`} />
          <span className="text-xs text-white font-medium truncate max-w-[8rem]">
            {participant.name || participant.identity}
          </span>
        </div>
        {participant.isSpeaking && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            Speaking
          </span>
        )}
      </div>
    </div>
  );
}

export default function RoomMonitorModal({ roomCode, onClose }: MonitorModalProps) {
  const allParticipants = useParticipants();

  /* esc to close */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const participantsInRoom = useMemo(() => {
    return allParticipants.filter((p) => {
      let breakoutRoomId: string | null = null;
      try {
        breakoutRoomId = JSON.parse(p.metadata || '{}').breakoutRoomId || null;
      } catch { /* ignore */ }
      return breakoutRoomId === roomCode;
    });
  }, [allParticipants, roomCode]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <h3 className="text-sm font-semibold text-white">Monitor: {roomCode}</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-500/20">
              God-View (Invisible)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {participantsInRoom.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Headphones className="w-8 h-8 text-gray-500" />
              <p className="text-sm text-gray-500">No participants in this room</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {participantsInRoom.map((p) => (
              <MonitoredParticipantTile key={p.identity} identity={p.identity} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-850 flex items-center justify-between text-[10px] text-gray-400">
          <span>{participantsInRoom.length} participant{participantsInRoom.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-500">Press ESC or ✕ to close</span>
        </div>
      </div>
    </div>
  );
}
