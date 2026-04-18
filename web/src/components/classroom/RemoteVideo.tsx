'use client';

import { useRef, useEffect, useState } from 'react';

interface RemoteVideoProps {
  stream: MediaStream | null;
  participantName: string;
  peerId: string;
  connectionState?: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

export default function RemoteVideo({ stream, participantName, peerId, connectionState }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [debugInfo, setDebugInfo] = useState({ videoTracks: 0, audioTracks: 0, state: 'no-stream' });

  // Update debug info when stream changes
  useEffect(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks().length;
      const audioTracks = stream.getAudioTracks().length;
      setDebugInfo({
        videoTracks,
        audioTracks,
        state: 'stream-received',
      });
      console.log(`📊 Debug info for ${participantName}: video=${videoTracks}, audio=${audioTracks}`);
    } else {
      setDebugInfo({ videoTracks: 0, audioTracks: 0, state: 'no-stream' });
    }
  }, [stream, participantName]);

  // Use useEffect to bind srcObject - prevents React render misses
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    
    console.log("📺 RemoteVideo stream updated:", stream.id, "Tracks:", stream.getTracks().length);
    
    // Bind stream to video element
    video.srcObject = stream;
    
    // Force play with onloadedmetadata to handle autoplay policy
    video.onloadedmetadata = () => {
      video.play().catch((err) => {
        console.error(`Autoplay blocked for ${participantName}:`, err);
      });
    };
    
    // onCanPlay handler - explicitly call play() when video is ready
    video.oncanplay = () => {
      console.log(`▶️ onCanPlay fired for ${participantName}`);
      video.play().catch((err) => {
        console.warn(`Play on canplay failed for ${participantName}:`, err);
      });
    };
    
    // Also try play immediately in case metadata already loaded
    video.play().catch((err) => {
      console.warn(`Failed to play video for ${participantName}:`, err);
    });
    
    // Handle the case where tracks are added LATER to an existing stream
    const handleTrackAdded = () => {
      console.log("➕ New track added to stream, refreshing video:", stream.id);
      // Reset and rebind to trigger video element update
      video.srcObject = null;
      video.srcObject = stream;
      video.play().catch(console.warn);
    };
    
    stream.addEventListener('addtrack', handleTrackAdded);
    
    // Cleanup when stream changes or component unmounts
    return () => {
      stream.removeEventListener('addtrack', handleTrackAdded);
      if (!stream) {
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
        {/* Debug overlay */}
        <div className="absolute top-2 right-2 bg-red-600/80 px-2 py-1 rounded text-xs text-white">
          {debugInfo.state}
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
        muted
        className="w-full h-full object-cover"
      />
      {/* Participant name */}
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
        {participantName}
      </div>
      {/* LIVE STREAM MONITOR DEBUG OVERLAY */}
      <div className="absolute top-2 right-2 bg-green-600/80 px-2 py-1 rounded text-xs text-white flex flex-col gap-0.5">
        <div>ICE: {connectionState || 'unknown'}</div>
        <div>Video: {debugInfo.videoTracks}</div>
        <div>Audio: {debugInfo.audioTracks}</div>
      </div>
    </div>
  );
}
