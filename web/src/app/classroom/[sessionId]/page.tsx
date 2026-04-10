'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import { useEngagementTracker } from '@/hooks/useEngagementTracker';
import Toolbar from '@/components/classroom/Toolbar';
import ParticipantsPanel from '@/components/classroom/Participants';
import Chat from '@/components/classroom/Chat';
import Timer from '@/components/classroom/Timer';

type MediaState = {
  micActive: boolean;
  cameraActive: boolean;
  screenShareActive: boolean;
};

type Participant = {
  userId: string;
  clientId: string;
  name?: string;
  status: 'online' | 'away' | 'offline';
  joinedAt?: Date;
  isHost?: boolean;
  media: MediaState;
};

export default function ClassroomPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const router = useRouter();
  const { user, tenantId, userId, userName } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Media streams refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const { start: startTracking, stop: stopTracking, active: trackingActive } = useEngagementTracker(socket);
  const startTimeRef = useRef(Date.now());

  // Initialize media devices (camera and microphone)
  const initializeMedia = useCallback(async (enableCamera: boolean = false, enableMic: boolean = true) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: enableCamera ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } : false,
        audio: enableMic
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Store references to tracks for toggling
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      
      audioTrackRef.current = audioTrack || null;
      videoTrackRef.current = videoTrack || null;

      // Attach video to preview element
      if (localVideoRef.current && videoTrack) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }

      setMediaError(null);
      console.log('Media initialized:', { hasAudio: !!audioTrack, hasVideo: !!videoTrack });
      return stream;
    } catch (err: any) {
      console.error('Failed to initialize media:', err);
      setMediaError(err.message || 'Failed to access camera/microphone');
      return null;
    }
  }, []);

  // Toggle microphone - actually enable/disable the audio track
  const handleToggleMic = useCallback((active: boolean) => {
    setMicActive(active);
    
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = active;
      console.log('Mic toggled:', active ? 'enabled' : 'disabled');
    }
    
    socket?.emit('engagementEvent', { type: 'MIC', payload: { active } });
  }, [socket]);

  // Toggle camera - actually start/stop the video track
  const handleToggleCamera = useCallback(async (active: boolean) => {
    if (active) {
      // Turn camera on - start video stream with video enabled
      if (!localStreamRef.current || !videoTrackRef.current) {
        // Need to get new stream with video
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: micActive 
          });
          localStreamRef.current = stream;
          
          const newVideoTrack = stream.getVideoTracks()[0];
          const newAudioTrack = stream.getAudioTracks()[0];
          videoTrackRef.current = newVideoTrack || null;
          audioTrackRef.current = newAudioTrack || null;
          
          // Attach to video element
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            await localVideoRef.current.play();
          }
        } catch (err) {
          console.error('Failed to start camera:', err);
          setMediaError('Failed to access camera');
          return;
        }
      } else if (videoTrackRef.current) {
        videoTrackRef.current.enabled = true;
      }
    } else {
      // Turn camera off - disable video track
      if (videoTrackRef.current) {
        videoTrackRef.current.enabled = false;
      }
    }

    setCameraActive(active);
    socket?.emit('engagementEvent', { type: 'CAMERA', payload: { active } });
  }, [socket, micActive]);

  // Toggle screen share
  const handleToggleScreenShare = useCallback((active: boolean) => {
    setScreenShareActive(active);
    socket?.emit('engagementEvent', { type: 'SCREEN_SHARE', payload: { active } });
  }, [socket]);

  // Track if we've already initialized to prevent duplicates
  const initializedRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    // Prevent duplicate initialization
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Set loading to false after short timeout (500ms)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    if (!sessionId || !userId || !tenantId) {
      return () => clearTimeout(timer);
    }

    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')
      ? `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')}/classroom`
      : 'ws://164.68.119.230:3000/classroom';

    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('joinClassroom', { 
        tenantId, 
        sessionId, 
        courseId: '', 
        userId, 
        classroomCode: sessionId,
        userName: userName || user?.email || 'Unknown User'
      });
    });

    newSocket.on('user-joined', (data: { userId: string; clientId: string; userName?: string }) => {
      setParticipants(prev => {
        if (prev.find(p => p.clientId === data.clientId)) return prev;
        return [...prev, {
          userId: data.userId,
          clientId: data.clientId,
          name: data.userName || data.userId.slice(0, 8),
          status: 'online',
          media: { micActive: false, cameraActive: false, screenShareActive: false },
        }];
      });
    });

    newSocket.on('user-left', (data: { clientId: string }) => {
      setParticipants(prev => prev.filter(p => p.clientId !== data.clientId));
    });

    newSocket.on('participant-media-update', (data: {
      userId: string;
      clientId: string;
      micActive?: boolean;
      cameraActive?: boolean;
      screenShareActive?: boolean;
    }) => {
      setParticipants(prev =>
        prev.map(p =>
          p.clientId === data.clientId || p.userId === data.userId
            ? {
                ...p,
                media: {
                  ...p.media,
                  ...(data.micActive !== undefined ? { micActive: data.micActive } : {}),
                  ...(data.cameraActive !== undefined ? { cameraActive: data.cameraActive } : {}),
                  ...(data.screenShareActive !== undefined ? { screenShareActive: data.screenShareActive } : {}),
                },
              }
            : p
        )
      );
    });

    // Initialize self participant when socket connects
    if (newSocket.connected && newSocket.id) {
      const self: Participant = {
        userId,
        clientId: newSocket.id,
        name: userName || user?.email || 'You',
        status: 'online',
        isHost: true,
        media: { micActive: true, cameraActive: false, screenShareActive: false },
      };
      setParticipants([self]);
    }
    
    return () => { 
      clearTimeout(timer); 
      newSocket.disconnect();
      initializedRef.current = false;
    };
  }, [sessionId, userId, tenantId, userName, user]);

  // Initialize media on mount (mic on by default) - non-blocking
  useEffect(() => {
    if (!loading) {
      // Don't block - initialize media in background
      initializeMedia(false, true).catch(err => {
        console.warn('Media initialization failed:', err);
      });
    }
  }, [loading, initializeMedia]);

  // Start engagement tracking when socket connects
  useEffect(() => {
    if (socket && userId && tenantId && !trackingActive) {
      startTracking();
    }
    return () => {
      if (trackingActive) {
        stopTracking();
      }
    };
  }, [socket, userId, tenantId, startTracking, stopTracking, trackingActive]);

  const handleLeave = useCallback(() => {
    // Clean up media streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    socket?.emit('engagementEvent', { type: 'LEAVE', payload: { sessionId } });
    stopTracking();
    socket?.disconnect();
    router.push('/dashboard/classroom');
  }, [socket, sessionId, stopTracking, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Joining classroom...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-lg">Classroom {sessionId?.slice(0, 8)}</h1>
          <div className="flex items-center gap-2">
            {/* Mic indicator */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${micActive ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {micActive ? (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
              {micActive ? 'Mic On' : 'Mic Off'}
            </div>
            {/* Camera indicator */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cameraActive ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {cameraActive ? (
                  <>
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                ) : (
                  <>
                    <path d="M23 7l-7 5 7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
              {cameraActive ? 'Cam On' : 'Cam Off'}
            </div>
            {/* Screen share indicator */}
            {screenShareActive && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/30 text-blue-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <path d="M8 21h8" />
                  <path d="M12 17v4" />
                </svg>
                Sharing
              </div>
            )}
          </div>
        </div>
        <Timer startTime={new Date(startTimeRef.current)} />
      </div>

      {/* Error display */}
      {mediaError && (
        <div className="bg-red-600/20 border-b border-red-600 px-4 py-2 text-red-400 text-sm">
          Media Error: {mediaError}
        </div>
      )}

      {/* Toolbar with camera support */}
      <Toolbar
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onLeave={handleLeave}
        micActive={micActive}
        cameraActive={cameraActive}
        screenShareActive={screenShareActive}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid / main area */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-gray-900 relative overflow-auto">
          {/* My camera preview - bottom left corner */}
          <div className="absolute bottom-4 left-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 z-10">
            {cameraActive ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                Camera Off
              </div>
            )}
          </div>

          {/* Participant video grid */}
          <div className="w-full max-w-[900px] p-6 mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {participants.map((p) => (
                <div key={p.clientId} className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mx-auto mb-2 text-2xl">
                      {p.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <p className="text-sm font-medium">{p.name || 'User'}</p>
                  </div>
                  {/* Media indicators on participant card */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {p.media.micActive ? (
                      <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">🎤</span>
                    ) : (
                      <span className="bg-red-500/80 px-1.5 py-0.5 rounded text-[10px]">🔇</span>
                    )}
                    {p.media.cameraActive && (
                      <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">📹</span>
                    )}
                    {p.media.screenShareActive && (
                      <span className="bg-blue-500/80 px-1.5 py-0.5 rounded text-[10px]">🖥️</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar with participants */}
        <div className="w-72 h-full border-l border-gray-700 overflow-hidden">
          <ParticipantsPanel
            participants={participants}
            currentUserId={userId || ''}
            showMediaStatus={true}
          />
        </div>
      </div>

      {/* Chat overlay - positioned on left to avoid overlapping sidebar */}
      {socket && (
        <Chat
          userId={userId || ''}
          userName={userName || ''}
          socket={socket}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}