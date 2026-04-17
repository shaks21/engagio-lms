'use client';

import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '@/lib/socket-context';

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
}

interface ParticipantsPanelProps {
  participants: Participant[];
  currentUserId: string;
  showMediaStatus?: boolean;
}

export default function ParticipantsPanel({
  participants,
  currentUserId,
  showMediaStatus = false,
}: ParticipantsPanelProps) {
  const { socket } = useSocket();
  const [mediaStates, setMediaStates] = useState<Record<string, MediaState>>({});

  // Listen for media updates from other participants
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

    socket.on('participant-media-update', handleMediaUpdate);
    socket.on('participant-engagement-update', handleMediaUpdate);

    return () => {
      socket.off('participant-media-update', handleMediaUpdate);
      socket.off('participant-engagement-update', handleMediaUpdate);
    };
  }, [socket]);

  const getMediaState = (userId: string) => {
    if (userId === currentUserId) {
      // Local participant - use actual state from MediaManager
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
            {participants.map((participant) => {
              const media = getMediaState(participant.userId);
              const isCurrent = participant.userId === currentUserId;

              return (
                <div
                  key={participant.clientId}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    isCurrent
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
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-blue-300' : 'text-gray-200'
                      }`}>
                        {participant.name || `User ${participant.userId.slice(0, 6)}`}
                        {isCurrent && <span className="ml-1 text-xs text-blue-400">(You)</span>}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {participant.isHost && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Host</span>
                        )}
                        {/* Media indicators */}
                        <span title={media.micActive ? 'Mic On' : 'Mic Off'}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={media.micActive ? '#22c55e' : '#ef4444'} strokeWidth="2">
                            {media.micActive ? (
                              <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></>
                            ) : (
                              <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><line x1="1" y1="1" x2="23" y2="23" /></>
                            )}
                          </svg>
                        </span>
                        <span title={media.cameraActive ? 'Camera On' : 'Camera Off'}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={media.cameraActive ? '#22c55e' : '#ef4444'} strokeWidth="2">
                            {media.cameraActive ? (
                              <><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></>
                            ) : (
                              <><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /><line x1="1" y1="1" x2="23" y2="23" /></>
                            )}
                          </svg>
                        </span>
                        {media.screenShareActive && (
                          <span title="Screen Sharing">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <path d="M8 21h8" /><path d="M12 17v4" />
                            </svg>
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
