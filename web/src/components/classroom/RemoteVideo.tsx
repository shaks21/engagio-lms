'use client';

import { useRef, useEffect } from 'react';

interface RemoteVideoProps {
  stream: MediaStream | null;
  participantName: string;
  peerId: string;
}

export default function RemoteVideo({ stream, participantName, peerId }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Use useEffect to bind srcObject - prevents React render misses
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      
      // Ensure video plays when stream is available
      video.play().catch((err) => {
        console.warn(`Failed to play video for ${participantName}:`, err);
      });
    }
    
    // Cleanup when stream becomes null
    return () => {
      if (video && !stream) {
        video.srcObject = null;
      }
    };
  }, [stream, participantName]);

  // Handle track additions dynamically (for when peer adds mic/camera mid-call)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    const handleTrack = () => {
      video.play().catch(console.warn);
    };

    stream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        console.log(`Track ended for ${participantName}:`, track.kind);
      });
    });

  }, [stream, participantName]);

  if (!stream) {
    return (
      <div className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mx-auto mb-2 text-2xl">
            {(participantName?.charAt(0) || 'U').toUpperCase()}
          </div>
          <p className="text-sm font-medium text-gray-300">{participantName}</p>
          <p className="text-xs text-gray-500">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
        {participantName}
      </div>
    </div>
  );
}
