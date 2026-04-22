'use client';

import { useEffect, useRef } from 'react';
import { useParticipants } from '@/lib/livekit-context';
import { Participant, Track } from 'livekit-client';

export interface RemoteVideoProps {
  /** LiveKit participant identity (when using LiveKit SFU) */
  participantIdentity?: string;
  /** WebRTC peer ID / clientId (when using socket.io/WebRTC fallback) */
  peerId?: string;
  /** Remote stream from WebRTC peer (socket.io/WebRTC fallback mode) */
  remoteStream?: MediaStream | null;
}

export default function RemoteVideo({ participantIdentity, peerId, remoteStream }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const participants = useParticipants() as Participant[];
  
  // Find LiveKit participant by identity (for LiveKit SFU mode)
  const resolvedParticipant = participants.find((p) => p.identity === participantIdentity);

  // Mode 1: LiveKit SFU mode - use participant's track
  useEffect(() => {
    if (resolvedParticipant && videoRef.current) {
      const video = videoRef.current;
      
      const videoTrackPublication = resolvedParticipant.getTrackPublication(Track.Source.Camera);
      if (!videoTrackPublication?.videoTrack) {
        video.srcObject = null;
        return;
      }
      
      const mediaStreamTrack = videoTrackPublication.videoTrack?.mediaStreamTrack;
      if (!mediaStreamTrack) {
        video.srcObject = null;
        return;
      }

      const stream = new MediaStream([mediaStreamTrack]);
      console.log('[RemoteVideo-LiveKit] Stream updated:', stream.id, 'Tracks:', stream.getTracks().length);
      video.srcObject = stream;

      video.onloadedmetadata = () => video.play().catch((err) => {
        console.error('[RemoteVideo-LiveKit] Autoplay blocked:', err);
      });

      video.play().catch((err) => {
        console.warn('[RemoteVideo-LiveKit] Play failed:', err);
      });
      
      return () => {
        video.srcObject = null;
      };
    }
  }, [resolvedParticipant?.identity]);

  // Mode 2: WebRTC fallback mode - use passed remoteStream prop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // If we have a remote stream passed directly, use it (WebRTC fallback mode)
    if (remoteStream) {
      console.log('[RemoteVideo-WebRTC] Setting stream:', remoteStream.id, 'Tracks:', remoteStream.getTracks().length);
      video.srcObject = remoteStream;
      
      video.onloadedmetadata = () => {
        video.play().catch((err) => {
          console.warn('[RemoteVideo-WebRTC] Autoplay blocked:', err);
        });
      };
      
      video.play().catch((err) => {
        console.warn('[RemoteVideo-WebRTC] Play failed:', err);
      });
      
      // Listen for new tracks being added
      const handleTrackAdded = () => {
        console.log('[RemoteVideo-WebRTC] New track added');
        if (video.srcObject !== remoteStream) {
          video.srcObject = remoteStream;
        }
      };
      
      remoteStream.addEventListener('addtrack', handleTrackAdded);
      
      return () => {
        remoteStream.removeEventListener('addtrack', handleTrackAdded);
        video.srcObject = null;
      };
    } else {
      video.srcObject = null;
    }
  }, [remoteStream?.id, remoteStream?.getTracks?.length]);

  // Show placeholder if no participant/stream available
  if (!resolvedParticipant && !remoteStream) {
    return (
      <div className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mx-auto mb-2 text-2xl">
            {(participantIdentity || peerId || 'U').charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-medium text-gray-300">
            {participantIdentity || peerId || 'Waiting for video...'}
          </p>
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
