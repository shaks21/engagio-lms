'use client';

import React from 'react';
import { Participant, Track } from 'livekit-client';
import { ParticipantTile, useParticipants, useLocalParticipant } from '@livekit/components-react';

// Grid styles
const gridStyles = {
  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: '#9ca3af',
    fontSize: '14px',
  } as React.CSSProperties,
};

/**
 * Custom ParticipantGrid that renders all participants (local + remote)
 * using LiveKit's context-aware ParticipantTile components.
 * Requires being rendered inside <LiveKitRoom>.
 */
export default function ParticipantGrid() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  console.log(
    '[ParticipantGrid] Local:',
    localParticipant?.identity,
    'Remotes:',
    participants.filter((p) => p !== localParticipant).length,
  );

  if (participants.length === 0) {
    return (
      <div style={gridStyles.emptyState}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</div>
        <div>Waiting for participants to join...</div>
      </div>
    );
  }

  return (
    <div style={gridStyles.container}>
      <div style={gridStyles.grid}>
        {participants.map((participant) => (
          <div key={participant.identity}>
            <ParticipantTile />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Simple participant name tag component
 */
export function ParticipantName({
  participant,
  showMicIndicator = true,
}: {
  participant: Participant;
  showMicIndicator?: boolean;
}) {
  const audioTrack = Array.from(participant.trackPublications.values()).find(
    (p) => p.track?.kind === Track.Kind.Audio && !p.isMuted,
  );
  const isSpeaking = (participant as any).isSpeaking === true;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
      }}
    >
      {showMicIndicator && (
        <span style={{ fontSize: '14px' }}>
          {audioTrack ? '🎤' : '🔇'}
          {isSpeaking && ' 🗣️'}
        </span>
      )}
      <span style={{ color: '#fff' }}>
        {participant.name || participant.identity}
        {participant.isLocal ? ' (You)' : ''}
      </span>
    </div>
  );
}
