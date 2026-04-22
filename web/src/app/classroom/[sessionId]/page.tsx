'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import { useEngagementTracker } from '@/hooks/useEngagementTracker';
import Toolbar from '@/components/classroom/Toolbar';
import ParticipantsPanel from '@/components/classroom/Participants';
import Chat from '@/components/classroom/Chat';
import Timer from '@/components/classroom/Timer';
import ParticipantGrid from '@/components/classroom/ParticipantGrid';
import LiveKitRoomWrapper from '@/components/classroom/LiveKitRoom';
import { Room, Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';
import axios from 'axios';

type MediaState = {
  micActive: boolean;
  cameraActive: boolean;
  screenShareActive: boolean;
};

type RoomConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

// LiveKit token response type
type TokenResponse = {
  token: string;
  livekitUrl: string;
  roomName: string;
};

export default function ClassroomPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const router = useRouter();
  const { user, tenantId, userId, userName } = useAuth();

  // LiveKit state
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkUrl, setLkUrl] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [lkRoom, setLkRoom] = useState<Room | null>(null);
  const [lkConnected, setLkConnected] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Socket.io for non-media events
  const socketRef = useRef<Socket | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);
  const [myClientId, setMyClientId] = useState<string>('');
  const myClientIdRef = useRef<string>('');

  // Update ref when myClientId changes
  useEffect(() => {
    myClientIdRef.current = myClientId;
  }, [myClientId]);

  const socket = socketRef.current;

  // Media state (local)
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Local stream for preview
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { start: startTracking, stop: stopTracking } = useEngagementTracker(socket);
  const startTimeRef = useRef(Date.now());
  const [loading, setLoading] = useState(true);

  // Fetch LiveKit token
  useEffect(() => {
    if (!userId || !userName || !sessionId) return;

    const fetchToken = async () => {
      try {
        console.log('[Classroom] Fetching LiveKit token for session:', sessionId);
        const response = await axios.get<TokenResponse>(
          `http://164.68.119.230:3000/api/classroom/token/${sessionId}`,
          {
            params: {
              userId,
              displayName: userName || user?.email || 'Unknown User',
              role: 'student',
            },
          }
        );

        console.log('[Classroom] Token response:', response.data);
        setLkToken(response.data.token);
        setLkUrl(response.data.livekitUrl);
        setRoomName(response.data.roomName);
        setLoading(false);
      } catch (error: any) {
        console.error('[Classroom] Failed to get LiveKit token:', error);
        setTokenError(error.response?.data?.message || 'Failed to join classroom');
        setLoading(false);
      }
    };

    fetchToken();
  }, [userId, userName, sessionId]);

  // Initialize socket.io for non-media events (chat, engagement)
  useEffect(() => {
    if (!sessionId || !userId) return;

    // Dynamic import to avoid SSR issues
    import('socket.io-client').then(({ default: io }) => {
      const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://164.68.119.230:3000'}/classroom`, {
        transports: ['websocket'],
        autoConnect: true,
      });

      socketRef.current = newSocket;
      setSocketState(newSocket);

      newSocket.on('connect', () => {
        console.log('[Socket] Connected:', newSocket.id);
        
        // Join the classroom namespace
        newSocket.emit('joinClassroom', {
          tenantId,
          sessionId,
          courseId: '',
          userId,
          classroomCode: sessionId,
          userName: userName || user?.email || 'Unknown User',
        });
      });

      newSocket.on('classroom-joined', (data: { clientId: string }) => {
        console.log('[Socket] Joined classroom, clientId:', data.clientId);
        setMyClientId(data.clientId);
        startTracking();
      });

      newSocket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
        stopTracking();
      });

      return () => {
        console.log('[Socket] Cleaning up...');
        newSocket.disconnect();
        stopTracking();
      };
    });
  }, [sessionId, userId, tenantId, userName]);

  // Handle LiveKit connection
  const handleLiveKitConnected = useCallback(() => {
    console.log('[LiveKit] Connected');
    setLkConnected(true);

    // Camera and mic are handled by LiveKit automatically based on device permissions
    // The ParticipantTile components will handle displaying local/remote tracks
  }, []);

  const handleLiveKitDisconnected = useCallback(() => {
    console.log('[LiveKit] Disconnected');
    setLkRoom(null);
    setLkConnected(false);
  }, []);

  const handleLiveKitError = useCallback((error: Error) => {
    console.error('[LiveKit] Error:', error);
    setMediaError(error.message);
  }, []);

  // Toggle mic
  const handleToggleMic = useCallback(async () => {
    if (!lkRoom) return;

    try {
      const lp = lkRoom.localParticipant;
      await lp.setMicrophoneEnabled(!micActive);
      setMicActive(!micActive);
      console.log('[LiveKit] Mic toggled:', !micActive);
    } catch (error) {
      console.error('[LiveKit] Failed to toggle mic:', error);
    }
  }, [lkRoom, micActive]);

  // Toggle camera
  const handleToggleCamera = useCallback(async () => {
    if (!lkRoom) return;

    try {
      const lp = lkRoom.localParticipant;
      await lp.setCameraEnabled(!cameraActive);
      setCameraActive(!cameraActive);
      console.log('[LiveKit] Camera toggled:', !cameraActive);
    } catch (error) {
      console.error('[LiveKit] Failed to toggle camera:', error);
    }
  }, [lkRoom, cameraActive]);

  // Toggle screen share
  const handleToggleScreenShare = useCallback(async () => {
    if (!lkRoom) return;

    try {
      const lp = lkRoom.localParticipant;
      await lp.setScreenShareEnabled(!screenShareActive);
      setScreenShareActive(!screenShareActive);
      console.log('[LiveKit] Screen share toggled:', !screenShareActive);
    } catch (error) {
      console.error('[LiveKit] Failed to toggle screen share:', error);
    }
  }, [lkRoom, screenShareActive]);

  // Leave classroom
  const handleLeave = useCallback(() => {
    if (lkRoom) {
      lkRoom.disconnect();
    }
    if (socket) {
      socket.disconnect();
    }
    stopTracking();
    router.push('/dashboard');
  }, [lkRoom, socket, router, stopTracking]);

  // Get tracks from LiveKit room
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  if (tracks.length === 0) {
    // console.log('[Classroom] No tracks available');
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to classroom...</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-white text-xl mb-2">Failed to Join Classroom</h2>
          <p className="text-gray-400">{tokenError}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-white text-lg font-semibold">Virtual Classroom</h1>
          <span className="text-gray-400 text-sm">
            {lkConnected ? (
              <span className="text-green-500">● Live</span>
            ) : (
              <span className="text-yellow-500">● Connecting...</span>
            )}
          </span>
        </div>
        <Timer startTime={new Date(startTimeRef.current)} />
      </div>

      {/* Error display */}
      {mediaError && (
        <div className="bg-red-600/20 border-b border-red-600 px-4 py-2 text-red-400 text-sm">
          Media Error: {mediaError}
        </div>
      )}

      {/* Main content */}
      {lkToken && lkUrl ? (
        <LiveKitRoomWrapper
          token={lkToken}
          serverUrl={lkUrl}
          roomName={roomName}
          userId={userId || ''}
          displayName={userName || user?.email || 'Unknown'}
          onConnected={handleLiveKitConnected}
          onDisconnected={handleLiveKitDisconnected}
          onError={handleLiveKitError}
        >
          {/* LiveKit Room Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Video grid */}
            <div className="flex-1 flex items-center justify-center overflow-auto">
              {<ParticipantGrid />}
            </div>

            {/* Chat panel */}
            <div className="w-80 border-l border-gray-700">
              <Chat userId={userId || ''} userName={userName || ''} socket={socket} sessionId={sessionId} />
            </div>
          </div>
        </LiveKitRoomWrapper>
      ) : (
        /* Fallback when no LiveKit token */
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🎥</div>
              <p className="text-white text-xl mb-2">Waiting for LiveKit connection...</p>
              <p className="text-gray-400">If this persists, refresh the page</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <Toolbar
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onLeave={handleLeave}
        micActive={micActive}
        cameraActive={cameraActive}
        screenShareActive={screenShareActive}
      />
    </div>
  );
}
