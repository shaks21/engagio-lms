'use client';

import React from 'react';

interface Participant {
  userId: string;
  clientId: string;
  name?: string;
  status: 'online' | 'away' | 'offline';
  joinedAt?: Date;
  isHost?: boolean;
}

interface ParticipantsPanelProps {
  participants: Participant[];
  currentUserId: string;
}

export default function ParticipantsPanel({
  participants,
  currentUserId,
}: ParticipantsPanelProps) {
  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Participants</h3>
          <span className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
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
            {participants.map((participant) => (
              <div
                key={participant.clientId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  participant.userId === currentUserId
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                {/* Left side: avatar + info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        participant.userId === currentUserId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {participant.name
                        ? participant.name.charAt(0).toUpperCase()
                        : 'U'}
                    </div>
                    {/* Status indicator */}
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        participant.status === 'online'
                          ? 'bg-green-500'
                          : participant.status === 'away'
                          ? 'bg-yellow-500'
                          : 'bg-gray-400'
                      }`}
                    />
                  </div>

                  {/* Name and role */}
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${
                        participant.userId === currentUserId
                          ? 'text-blue-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {participant.name || `User ${participant.userId.slice(0, 6)}`}
                      {participant.userId === currentUserId && (
                        <span className="ml-1 text-xs text-blue-500">(You)</span>
                      )}
                    </span>
                    {participant.isHost && (
                      <span className="text-xs text-amber-600">Host</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      participant.status === 'online'
                        ? 'bg-green-100 text-green-700'
                        : participant.status === 'away'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {participant.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
