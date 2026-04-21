'use client';

import { useEffect, useRef } from 'react';
import { useParticipants } from '@/lib/livekit-context';
import { Participant, Track } from 'livekit-client';

export interface RemoteVideoProps {
  participantIdentity?: string;
}

export default function RemoteVideo({ participantIdentity }: RemoteVideoProps) {
  const participants = useParticipants() as Participant[];
  const videoRef = useRef<HTMLVideoElement>(null);

  // Find participant by identity string
  const resolvedParticipant = participants.find((p) => p.identity === participantIdentity);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!resolvedParticipant) { video.srcObject = null; return; }

    // LiveKit: get video track from participant
    const videoTrackPublication = resolvedParticipant.getTrackPublication(Track.Source.Camera);
    if (!videoTrackPublication) { video.srcObject = null; return; }
    
    const mediaStreamTrack = videoTrackPublication.videoTrack?.mediaStreamTrack;
    if (!mediaStreamTrack) { video.srcObject = null; return; }

    const stream = new MediaStream([mediaStreamTrack]);
    console.log('📺 RemoteVideo stream updated:', stream.id, 'Tracks:', stream.getTracks().length);
    video.srcObject = stream;

    video.onloadedmetadata = () => video.play().catch((err) => {
      console.error('Autoplay blocked for', resolvedParticipant.name, ':', err);
    });

    video.oncanplay = () => video.play().catch((err) => {
      console.warn('Play on canplay failed for', resolvedParticipant.name, ':', err);
    });

    video.play().catch((err) => {
      console.warn('Failed to play video for', resolvedParticipant.name + ':', err);
    });

    // Use generic event listener to avoid type issues
    const onTrackAdded: EventListener = (e: Event) => {
      console.log('➕ New track added for', resolvedParticipant.name);
      video.srcObject = stream;
      video.play().catch(console.warn);
    };

    stream.addEventListener('addtrack', onTrackAdded);

    return () => {
      stream.removeEventListener('addtrack', onTrackAdded);
      video.srcObject = null;
    };
  }, [resolvedParticipant?.identity]);

  if (!resolvedParticipant) {
    return (
      <div className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mx-auto mb-2 text-2xl">
            {participantIdentity?.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-medium text-gray-300">{participantIdentity}</p>
        </div>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
}
