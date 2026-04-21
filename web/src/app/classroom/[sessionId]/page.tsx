'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import { useEngagementTracker } from '@/hooks/useEngagementTracker';
import Toolbar from '@/components/classroom/Toolbar';
import ParticipantsPanel from '@/components/classroom/Participants';
import RemoteVideo from '@/components/classroom/RemoteVideo';
import { useWebRTC } from "@/hooks/useWebRTC";
import { useParticipants } from "@/lib/livekit-context";
import Chat from '@/components/classroom/Chat';
import Timer from '@/components/classroom/Timer';

type MediaState = {
  micActive: boolean;
  cameraActive: boolean;
  screenShareActive: boolean;
};

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

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

  // Stable socket reference - useRef to prevent re-render disconnections
  // This ensures the socket doesn't disconnect during React re-renders
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null); // For UI rendering
  const [myClientId, setMyClientId] = useState<string>(''); // Stable clientId from server
  const myClientIdRef = useRef<string>(''); // Ref for accessing current value in callbacks

  // Update ref when myClientId changes
  useEffect(() => {
    myClientIdRef.current = myClientId;
  }, [myClientId]);

  // Stable socket getter - always returns current socket without triggering re-renders
  const socket = socketRef.current;
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const mediaManagerRef = useRef<any>(null);
  if (!mediaManagerRef.current) {
    mediaManagerRef.current = new (require('@/lib/MediaManager')).MediaManager();
  }
  const mediaManager = mediaManagerRef.current;
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

  // WebRTC for peer-to-peer video/audio - use stable clientId from server
  const { peers: remotePeers, createOffer } = useWebRTC({
    socket,
    sessionId,
    mediaManager,
    localStreamRef,
    connectionStates,
    setConnectionStates,
    clientId: myClientId || '', // Use stable clientId from server
  });

  const allParticipants = useParticipants();

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

      // Check if browser supports media devices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('Browser does not support media devices');
        setMediaError('Media not supported in this environment');
        return null;
      }

      // Try to get user media - will fail gracefully on HTTP/non-secure contexts
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
      const errorMessage = err?.message || err?.name || 'Failed to access camera/microphone';
      setMediaError(errorMessage);
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
    console.log('handleToggleCamera called with:', active);
    
    if (active) {
      // Turn camera on - start video stream with video enabled
      try {
        console.log('Requesting camera with video+audio...');
        // Request BOTH video and audio to ensure mic works
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: true 
        });
        
        console.log('Stream obtained:', stream.id, 'tracks:', stream.getTracks().map(t => t.kind));
        
        // Store stream
        localStreamRef.current = stream;
        
        const newVideoTrack = stream.getVideoTracks()[0];
        const newAudioTrack = stream.getAudioTracks()[0];
        
        console.log('Video track:', newVideoTrack?.id, 'enabled:', newVideoTrack?.enabled);
        console.log('Audio track:', newAudioTrack?.id, 'enabled:', newAudioTrack?.enabled);
        
        videoTrackRef.current = newVideoTrack || null;
        audioTrackRef.current = newAudioTrack || null;
        
        // CRITICAL: Must set cameraActive BEFORE attaching to video to ensure element exists
        setCameraActive(true);
        
        // Attach to video element - need to wait for re-render
        setTimeout(() => {
          if (localVideoRef.current) {
            console.log('Attaching stream to video element');
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(err => console.error('Play error:', err));
          } else {
            console.warn('localVideoRef.current is null - video element not mounted');
          }
        }, 100);
        
        // Notify socket that media is now available - this will trigger peers to connect
        socket?.emit('engagementEvent', { type: 'CAMERA', payload: { active: true } });
        // Also emit a custom event to signal media readiness for WebRTC using STABLE clientId
        socket?.emit('media-ready', { clientId: myClientId, hasVideo: true, hasAudio: true });
        
      } catch (err: any) {
        console.error('Failed to start camera:', err);
        const errorMessage = err?.message || err?.name || 'Failed to access camera';
        setMediaError(errorMessage);
        return;
      }
    } else {
      // Turn camera off - stop tracks
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        videoTrackRef.current = null;
      }
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        audioTrackRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      setCameraActive(false);
      
      // Notify socket that media is no longer available
      socket?.emit('engagementEvent', { type: 'CAMERA', payload: { active: false } });
      socket?.emit('media-ready', { clientId: myClientId, hasVideo: false, hasAudio: false });
    }

    socket?.emit('engagementEvent', { type: 'CAMERA', payload: { active } });
  }, [socket, myClientId]);

  // Toggle screen share
  const handleToggleScreenShare = useCallback((active: boolean) => {
    setScreenShareActive(active);
    socket?.emit('engagementEvent', { type: 'SCREEN_SHARE', payload: { active } });
  }, [socket]);

  // Track if we've already initialized to prevent duplicates
  // Use a single ref for socket initialization
  const initializedRef = useRef(false);

  // Store createOffer in ref to prevent infinite loop
  const createOfferRef = useRef(createOffer);
  createOfferRef.current = createOffer;
  
  useEffect(() => {
    // Prevent duplicate initialization
    if (initializedRef.current) {
      return;
    }
    
    // Set loading to false after short timeout (500ms) - ALWAYS, even if auth not ready
    // This prevents getting stuck on "Joining classroom" screen
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    // If sessionId is missing, we can't proceed - but still stop loading
    if (!sessionId) {
      console.warn('No sessionId found, redirecting to dashboard');
      router.push('/dashboard/classroom');
      return () => clearTimeout(timer);
    }

    // If auth is not ready yet, we can't proceed - but still stop loading spinner
    if (!userId || !tenantId) {
      console.log('Auth not ready yet, waiting...');
      // Return without connecting socket - useEffect will re-run when auth becomes ready
      // Timer will still fire after 500ms to stop the loading spinner
      return () => clearTimeout(timer);
    }

    // Now we have auth ready, proceed with socket connection
    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')
      ? `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws')}/classroom`
      : 'ws://164.68.119.230:3000/classroom';

    // Create new socket with explicit cleanup and reconnection
    // Use socketRef to store the socket instance (stable across re-renders)
    const newSocket = io(SOCKET_URL, { 
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    // Store in ref (won't trigger re-render)
    socketRef.current = newSocket;
    // Also set state for initial render
    setSocketState(newSocket);
    initializedRef.current = true;

    newSocket.on('connect', () => {
      console.log('Socket connected, joining classroom...');
      
      // OPTIMISTIC UI: Add self to participants immediately
      // This prevents "0 participants" showing while waiting for server response
      const tempClientId = `temp-${userId}-${Date.now()}`.slice(0, 36);
      setParticipants(prev => {
        // Only add if not already present
        if (prev.some(p => p.userId === userId)) return prev;
        return [...prev, {
          userId,
          clientId: tempClientId,
          name: userName || user?.email || 'Unknown User',
          status: 'online',
          joinedAt: new Date(),
          media: { micActive: false, cameraActive: false, screenShareActive: false },
          isHost: true,
        }];
      });
      
      newSocket.emit('joinClassroom', { 
        tenantId, 
        sessionId, 
        courseId: '', 
        userId, 
        classroomCode: sessionId,
        userName: userName || user?.email || 'Unknown User'
      });
    });

    // Handle join response with current participants (HYDRATION)
    newSocket.on('classroom-joined', (data: { 
      status: string; 
      clientId: string; 
      currentParticipants: Array<{ 
        clientId: string; 
        userId: string; 
        userName?: string; 
        joinedAt: string;
        mediaState: { hasVideo: boolean; hasAudio: boolean; isScreenSharing: boolean };
      }> 
    }) => {
      console.log('classroom-joined response:', data);
      console.log('My stable clientId:', data.clientId);
      
      // Set our stable clientId for use in WebRTC
      setMyClientId(data.clientId);
      
      // Hydrate with existing participants (includes self from server)
      const hydrated: Participant[] = data.currentParticipants.map(p => ({
        userId: p.userId,
        clientId: p.clientId,
        name: p.userName || p.userId.slice(0, 8),
        status: 'online' as const,
        joinedAt: new Date(p.joinedAt),
        media: { 
          micActive: p.mediaState?.hasAudio ?? false, 
          cameraActive: p.mediaState?.hasVideo ?? false, 
          screenShareActive: p.mediaState?.isScreenSharing ?? false 
        },
        isHost: p.userId === userId, // Mark self as host
      }));
      
      // Merge: Replace temp entry with real one if exists, otherwise add all
      setParticipants(prev => {
        // Remove temp self entry
        const withoutTemp = prev.filter(p => !p.clientId.startsWith('temp-'));
        // Check if we already have self in hydrated (from server response)
        const hasSelf = hydrated.some(p => p.userId === userId);
        if (hasSelf) {
          return hydrated;
        } else {
          // Server didn't include self, use hydrated + updated self
          const updatedSelf = hydrated.find(p => p.userId === userId);
          if (updatedSelf) {
            return hydrated;
          }
          return [...hydrated];
        }
      });
    });

    newSocket.on('user-joined', (data: { userId: string; clientId: string; userName?: string }) => {
      console.log('user-joined event:', data);
      setParticipants(prev => {
        if (prev.find(p => p.clientId === data.clientId || p.userId === data.userId)) return prev;
        return [...prev, {
          userId: data.userId,
          clientId: data.clientId,
          name: data.userName || data.userId.slice(0, 8),
          status: 'online',
          media: { micActive: false, cameraActive: false, screenShareActive: false },
        }];
      });
    });

    newSocket.on('user-left', (data: { clientId: string; userId?: string }) => {
      console.log('user-left event:', data);
      setParticipants(prev => prev.filter(p => p.clientId !== data.clientId && p.userId !== data.userId));
    });

    newSocket.on('participant-joined-media', (data: { 
      clientId: string; 
      userId?: string; 
      hasVideo: boolean; 
      hasAudio: boolean 
    }) => {
      console.log('participant-joined-media:', data);
      // Update participant's media state
      setParticipants(prev => 
        prev.map(p =>
          p.clientId === data.clientId || p.userId === data.userId
            ? {
                ...p,
                media: {
                  ...p.media,
                  ...(data.hasVideo !== undefined ? { cameraActive: data.hasVideo } : {}),
                  ...(data.hasAudio !== undefined ? { micActive: data.hasAudio } : {}),
                },
              }
            : p
        )
      );
    });

    newSocket.on('participant-media-update', (data: {
      userId?: string;
      clientId: string;
      micActive?: boolean;
      cameraActive?: boolean;
      screenShareActive?: boolean;
      hasVideo?: boolean;
      hasAudio?: boolean;
    }) => {
      console.log('participant-media-update:', data);
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
                  ...(data.hasVideo !== undefined ? { cameraActive: data.hasVideo } : {}),
                  ...(data.hasAudio !== undefined ? { micActive: data.hasAudio } : {}),
                },
              }
            : p
        )
      );
    });

    // Listen for participant-joined-media events to trigger WebRTC connections
    newSocket.on('participant-joined-media', (data: { 
      clientId: string; 
      userId?: string; 
      hasVideo: boolean; 
      hasAudio: boolean 
    }) => {
      console.log('participant-joined-media:', data);
      // Use ref to get current myClientId (avoids stale closure)
      const currentMyClientId = myClientIdRef.current;
      console.log('My clientId:', currentMyClientId, 'Peer clientId:', data.clientId);
      
      // Create WebRTC connection to this peer regardless of whether we have local media
      // They may want to send their media to us, even if we don't have media to send
      if (data.clientId !== currentMyClientId) {
        console.log('Creating WebRTC offer for participant-joined-media:', data.clientId);
        createOfferRef.current(data.clientId);
      }
    });

    // Legacy: Listen for media-ready events to establish WebRTC connections
    newSocket.on('media-ready', (data: { clientId: string; hasVideo: boolean; hasAudio: boolean }) => {
      console.log('Peer ready for media:', data, 'my stream:', localStreamRef.current?.getTracks().length);
      // Use ref to get current myClientId (avoids stale closure)
      const currentMyClientId = myClientIdRef.current;
      
      // Ignore our own media-ready events
      if (data.clientId === currentMyClientId) return;
      
      // Create WebRTC connection to this peer regardless of whether we have local media
      // They may want to send their media to us
      console.log('Creating WebRTC offer for media-ready peer:', data.clientId);
      createOfferRef.current(data.clientId);
    });
    return () => { 
      console.log('🧹 Cleaning up socket connection...');
      clearTimeout(timer); 
      if (newSocket) {
        newSocket.disconnect();
      }
      initializedRef.current = false;
    };
  }, [sessionId, userId, tenantId, userName]);

  // Initialize media on mount (mic on by default) - non-blocking
  useEffect(() => {
    if (!loading) {
      // Don't block - initialize media in background
      initializeMedia(false, true).catch(err => {
        console.warn('Media initialization failed:', err);
      });
    }
  }, [loading, initializeMedia]);

  // Create WebRTC offer when a new user joins (initiate connection) - only if we have media
  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = (data: { userId: string; clientId: string; userName?: string }) => {
      console.log('New user joined:', data.clientId);
      // Only create offer if we have local media (camera or mic active)
      if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
        console.log('Creating WebRTC offer for:', data.clientId, 'with tracks:', localStreamRef.current.getTracks().map(t => t.kind));
        createOfferRef.current(data.clientId);
      } else {
        console.log('No local media yet, skipping WebRTC offer for:', data.clientId);
      }
    };

    socket.on('user-joined', handleUserJoined);

    return () => {
      socket.off('user-joined', handleUserJoined);
    };
  }, [socket, createOffer]);

  // Start engagement tracking when socket connects
  useEffect(() => {
    if (!socket || !userId || !tenantId || trackingActive) return;

    const onConnect = () => {
      console.log('Socket connected, starting engagement tracking');
      startTracking();
    };

    socket.on('connect', onConnect);

    // If already connected, start immediately
    if (socket.connected) {
      startTracking();
    }

    return () => {
      socket.off('connect', onConnect);
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
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          {/* My camera preview - bottom left corner (only show when not in main grid) */}
          {!cameraActive && (
            <div className="absolute bottom-4 left-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600 z-10">
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                Camera Off
              </div>
            </div>
          )}

          {/* Participant video grid - includes self and remote participants */}
          <div className="w-full max-w-[900px] p-6 mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {/* Show self in main grid if camera is active */}
              {cameraActive && localStreamRef.current && (
                <div className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
                    You {micActive ? '🎤' : '🔇'}
                  </div>
                </div>
              )}
              
              {/* Remote participants with WebRTC streams - using RemoteVideo component */}
              {remotePeers.map((peer) => (
                <RemoteVideo key={peer.peerId} participantIdentity={peer.peerId} />
              ))}
              
              {/* Other participants without WebRTC connection yet (show avatar) */}
              {participants
                .filter(p => p.clientId !== socket?.id && !remotePeers.some(peer => peer.peerId === p.clientId))
                .map((p) => (
                  <div key={p.clientId} className="relative bg-gray-800 rounded-xl aspect-video flex items-center justify-center overflow-hidden">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center mx-auto mb-2 text-2xl">
                        {p.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <p className="text-sm font-medium">{p.name || 'User'}</p>
                    </div>
                    {/* Media indicators */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {p.media.micActive ? (
                        <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">🎤</span>
                      ) : (
                        <span className="bg-red-500/80 px-1.5 py-0.5 rounded text-[10px]">🔇</span>
                      )}
                      {p.media.cameraActive && (
                        <span className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">📹</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right sidebar with participants */}
        <div className="hidden md:block w-72 h-full border-l border-gray-700 overflow-hidden">
          <ParticipantsPanel
            participants={participants}
            currentUserId={userId || ''}
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