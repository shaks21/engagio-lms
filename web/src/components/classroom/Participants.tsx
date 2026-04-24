'use client';

import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '@/lib/socket-context';
import { Hand, Mic, MicOff, Video, VideoOff, MonitorUp, Crown } from 'lucide-react';

type MediaState = {
  micActive: boolean;
  cameraActive: boolean;
  screenShareActive: boolean;
};

interface Participant {
  userId: string;
  clientId: string;
  name?: string;
  status: 'online' | 'away' | 'offline';
  joinedAt?: Date;
  isHost?: boolean;
  media?: MediaState;
  handRaised?: boolean;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  currentUserId: string;
  showMediaStatus?: boolean;
  raisedHands?: Record<string, boolean>;
}

export default function ParticipantsPanel({
  participants,
  currentUserId,
  showMediaStatus = false,
  raisedHands: externalRaisedHands,
}: ParticipantsPanelProps) {
  const { socket } = useSocket();
  const [mediaStates, setMediaStates] = useState<Record<string, MediaState>>({});
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});

  // Merge props with internal state
  const mergedRaisedHands = React.useMemo(() => {
    return { ...raisedHands, ...(externalRaisedHands || {}) };
  }, [raisedHands, externalRaisedHands]);

  // Listen for media + hand-raise updates from other participants
  useEffect(() => {
    if (!socket) return;

    const handleMediaUpdate = (data: any) => {
      setMediaStates((prev) => ({
        ...prev,
        [data.userId]: {
          micActive: data.micActive ?? prev[data.userId]?.micActive ?? false,
          cameraActive: data.cameraActive ?? prev[data.userId]?.cameraActive ?? false,
          screenShareActive: data.screenShareActive ?? prev[data.userId]?.screenShareActive ?? false,
        },
      }));
    };

    const handleHandRaise = (data: any) => {
      if (!data?.userId) return;
      setRaisedHands((prev) => ({ ...prev, [data.userId]: data.raised }));
    };

    socket.on('participant-media-update', handleMediaUpdate);
    socket.on('participant-engagement-update', handleMediaUpdate);
    socket.on('participant-hand-raise', handleHandRaise);

    return () => {
      socket.off('participant-media-update', handleMediaUpdate);
      socket.off('participant-engagement-update', handleMediaUpdate);
      socket.off('participant-hand-raise', handleHandRaise);
    };
  }, [socket]);

  const getMediaState = (userId: string) => {
    if (userId === currentUserId) {
      return mediaStates[userId] || {
        micActive: true,
        cameraActive: false,
        screenShareActive: false,
      };
    }
    return mediaStates[userId] || {
      micActive: false,
      cameraActive: false,
      screenShareActive: false,
    };
  };

  // Sort: hand-raised first, then host, then alphabetically
  const sortedParticipants = React.useMemo(() => {
    const list = [...participants];
    list.sort((a, b) => {
      const aHand = mergedRaisedHands[a.userId] ? 1 : 0;
      const bHand = mergedRaisedHands[b.userId] ? 1 : 0;
      if (bHand !== aHand) return bHand - aHand;
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return (a.name || a.userId).localeCompare(b.name || b.userId);
    });
    return list;
  }, [participants, mergedRaisedHands]);

  return (
    <div className="border-l border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Participants</h3>
          <span className="bg-blue-600/20 text-blue-400 text-xs font-medium px-2 py-1 rounded-full">
            {participants.length}
          </span>
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-3">
        {participants.length === 0 ? (
          <div className="text-gray-400 text-center py-8 text-sm">
            No participants yet
          </div>
        ) : (
          <div className="space-y-2">
            {sortedParticipants.map((participant) => {
              const media = getMediaState(participant.userId);
              const isCurrent = participant.userId === currentUserId;
              const isHandRaised = mergedRaisedHands[participant.userId];

              return (
                <div
                  key={participant.clientId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    isHandRaised
                      ? 'bg-yellow-500/10 border border-yellow-500/30'
                      : isCurrent
                      ? 'bg-blue-600/10 border border-blue-500/30'
                      : 'bg-gray-700/50'
                  }`}
                >
                  {/* Left: avatar + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'
                      }`}>
                        {participant.name ? participant.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${
                        participant.status === 'online' ? 'bg-green-500'
                          : participant.status === 'away' ? 'bg-yellow-500'
                          : 'bg-gray-500'
                      }`} />
                      {/* Hand raise overlay */}
                      {isHandRaised && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full border-2 border-gray-900 flex items-center justify-center"
                              title="Hand raised">
                          <Hand className="w-2.5 h-2.5 text-black" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-medium truncate flex items-center gap-1.5 ${
                        isCurrent ? 'text-blue-300' : 'text-gray-200'
                      }`}>
                        {participant.name || `User ${participant.userId.slice(0, 6)}`}
                        {isCurrent && <span className="text-xs text-blue-400">(You)</span>}
                        {isHandRaised && (
                          <span className="text-yellow-400 text-xs font-medium flex items-center gap-0.5">
                            <Hand className="w-3 h-3" /> Raised
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {participant.isHost && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-0.5">
                            <Crown className="w-3 h-3" /> Host
                          </span>
                        )}
                        {/* Media indicators */}
                        <span title={media.micActive ? 'Mic On' : 'Mic Off'}>
                          {media.micActive ? <Mic className="w-3 h-3 text-green-400" /> : <MicOff className="w-3 h-3 text-gray-500" />}
                        </span>
                        <span title={media.cameraActive ? 'Camera On' : 'Camera Off'}>
                          {media.cameraActive ? <Video className="w-3 h-3 text-green-400" /> : <VideoOff className="w-3 h-3 text-gray-500" />}
                        </span>
                        {media.screenShareActive && (
                          <span title="Screen Sharing">
                            <MonitorUp className="w-3 h-3 text-blue-400" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
