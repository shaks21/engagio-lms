'use client';

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import { MediaManager } from '@/lib/MediaManager';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

type PeerConnectionState = {
  peerId: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
};

type UseWebRTCProps = {
  socket: Socket | null;
  sessionId: string;
  mediaManager: MediaManager;
  clientId: string;
  connectionStates: Record<string, ConnectionState>;
  setConnectionStates: React.Dispatch<React.SetStateAction<Record<string, ConnectionState>>>;
};

export function useWebRTC({
  socket,
  sessionId,
  mediaManager,
  clientId,
  connectionStates,
  setConnectionStates,
}: UseWebRTCProps) {
  const [peers, setPeers] = useState<PeerConnectionState[]>([]);
  const peersRef = useRef<PeerConnectionState[]>([]);
  const reconnectionAttempts = useRef<Record<string, number>>({});
  const isInitiatorRef = useRef<Set<string>>(new Set());

  // ICE servers with TURN fallback
  const iceServers: RTCIceServer[] = useMemo(() => [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ], []);

  const createPeerConnection = useCallback((peerId: string, initiator: boolean = true): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers });

    // Track whether WE initiated the connection (to avoid duplicate offers)
    if (initiator) {
      isInitiatorRef.current.add(peerId);
    }

    // Add local tracks
    const localStream = mediaManager.getStream();
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStream);
        // Store track kind for negotiation
        (sender as any).trackKind = track.kind;
      });
    }

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      const state: ConnectionState = pc.iceConnectionState as ConnectionState;
      
      setConnectionStates((prev) => ({ ...prev, [peerId]: state }));
      
      console.log(`ICE connection state for ${peerId}: ${state}`);
      
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        // Clean up peer connection
        pc.close();
        peersRef.current = peersRef.current.filter((p) => p.peerId !== peerId);
        setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
        isInitiatorRef.current.delete(peerId);
        
        // Schedule reconnection attempt
        const attempts = reconnectionAttempts.current[peerId] || 0;
        if (attempts < 3) {
          reconnectionAttempts.current = { ...reconnectionAttempts.current, [peerId]: attempts + 1 };
          setTimeout(() => {
            // Only retry if we have local media
            const stream = mediaManager.getStream();
            if (stream && stream.getTracks().length > 0) {
              setConnectionStates((prev) => ({ ...prev, [peerId]: 'connecting' }));
              // Will need to request new offer from peer - handled by parent
            }
          }, 1000 * Math.min(2 ** attempts, 10));
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetClientId: peerId,
          candidate: event.candidate,
          sessionId,
        });
      }
    };

    // Handle incoming tracks - CRITICAL: Proper stream mapping
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      
      // Create a stable stream ID based on peer
      if (remoteStream) {
        (remoteStream as any).peerId = peerId;
      }

      setPeers((prev) => {
        const existingIndex = prev.findIndex((p) => p.peerId === peerId);
        if (existingIndex >= 0) {
          // Update existing peer with new stream
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            remoteStream: remoteStream || new MediaStream(),
            connectionState: 'connected',
          };
          return updated;
        }
        // Add new peer
        return [...prev, { 
          peerId, 
          connection: pc, 
          remoteStream: remoteStream || new MediaStream(), 
          connectionState: 'connected' 
        }];
      });
      
      setConnectionStates((prev) => ({ ...prev, [peerId]: 'connected' }));
      reconnectionAttempts.current = { ...reconnectionAttempts.current, [peerId]: 0 };
    };

    // CRITICAL: Handle negotiation needed for track additions
    pc.onnegotiationneeded = async () => {
      // Only initiate if we started the connection (avoid duplicate offers)
      if (!isInitiatorRef.current.has(peerId)) {
        console.log(`Skipping negotiation - not initiator for ${peerId}`);
        return;
      }

      try {
        console.log(`Negotiation needed for ${peerId}, creating offer...`);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);

        socket?.emit('webrtc-offer', {
          targetClientId: peerId,
          offer: pc.localDescription,
          sessionId,
        });
      } catch (err) {
        console.error('Negotiation offer failed:', err);
      }
    };

    // Store in ref immediately
    peersRef.current = [...peersRef.current, { 
      peerId, 
      connection: pc, 
      remoteStream: null, 
      connectionState: 'connecting' 
    }];
    
    return pc;
  }, [mediaManager, socket, sessionId, iceServers]);

  // Create offer to a specific peer
  const createOffer = useCallback(
    (targetClientId: string) => {
      // Don't create duplicate connections
      if (peersRef.current.some(p => p.peerId === targetClientId)) {
        console.log(`Already connected to ${targetClientId}, skipping offer`);
        return;
      }
      
      console.log(`Creating WebRTC offer to ${targetClientId}`);
      const pc = createPeerConnection(targetClientId, true);
      
      setPeers((prev) => [...prev.filter((p) => p.peerId !== targetClientId), {
        peerId: targetClientId,
        connection: pc,
        remoteStream: null,
        connectionState: 'connecting',
      }]);
      setConnectionStates((prev) => ({ ...prev, [targetClientId]: 'connecting' }));

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket?.emit('webrtc-offer', {
            targetClientId,
            offer: pc.localDescription,
            sessionId,
          });
        })
        .catch((err) => {
          console.error('Failed to create offer:', err);
          setConnectionStates((prev) => ({ ...prev, [targetClientId]: 'failed' }));
        });
    },
    [createPeerConnection, socket, sessionId]
  );

  // Handle incoming offer
  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, senderClientId: string) => {
      console.log(`Handling offer from ${senderClientId}`);
      
      // Check if we already have a connection
      const existingPeer = peersRef.current.find(p => p.peerId === senderClientId);
      if (existingPeer) {
        // Close existing and recreate
        existingPeer.connection.close();
        peersRef.current = peersRef.current.filter(p => p.peerId !== senderClientId);
        setPeers(prev => prev.filter(p => p.peerId !== senderClientId));
      }
      
      // Create peer connection as answerer (not initiator)
      const pc = createPeerConnection(senderClientId, false);
      
      setPeers((prev) => [...prev.filter((p) => p.peerId !== senderClientId), {
        peerId: senderClientId,
        connection: pc,
        remoteStream: null,
        connectionState: 'connecting',
      }]);
      setConnectionStates((prev) => ({ ...prev, [senderClientId]: 'connecting' }));

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(answer);
        
        socket?.emit('webrtc-answer', {
          targetClientId: senderClientId,
          answer: pc.localDescription,
          sessionId,
        });
      } catch (err) {
        console.error('Failed to handle offer:', err);
        setConnectionStates((prev) => ({ ...prev, [senderClientId]: 'failed' }));
      }
    },
    [createPeerConnection, socket, sessionId]
  );

  // Handle incoming answer
  const handleAnswer = useCallback(
    (answer: RTCSessionDescriptionInit, senderClientId: string) => {
      const peer = peersRef.current.find((p) => p.peerId === senderClientId);
      if (peer?.connection) {
        peer.connection.setRemoteDescription(new RTCSessionDescription(answer))
          .then(() => {
            console.log(`Remote description set for ${senderClientId}`);
          })
          .catch((err) => console.error('Failed to set remote description:', err));
      }
    },
    []
  );

  // Handle ICE candidate
  const handleIceCandidate = useCallback(
    (candidate: RTCIceCandidateInit, senderClientId: string) => {
      const peer = peersRef.current.find((p) => p.peerId === senderClientId);
      if (peer?.connection) {
        peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
          .catch((err) => console.error('Failed to add ICE candidate:', err));
      }
    },
    []
  );

  // Clean up peer on user left
  const handleUserLeft = useCallback((data: { clientId: string; userId?: string }) => {
    const peerId = data.clientId;
    const peer = peersRef.current.find(p => p.peerId === peerId);
    
    if (peer) {
      peer.connection.close();
    }
    
    peersRef.current = peersRef.current.filter((p) => p.peerId !== peerId);
    isInitiatorRef.current.delete(peerId);
    
    setPeers((prev) => prev.filter((p) => p.peerId !== peerId));
    setConnectionStates((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    reconnectionAttempts.current = { ...reconnectionAttempts.current, [peerId]: 0 };
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc-offer', (data: { offer: RTCSessionDescriptionInit; senderClientId: string }) => {
      handleOffer(data.offer, data.senderClientId);
    });

    socket.on('webrtc-answer', (data: { answer: RTCSessionDescriptionInit; senderClientId: string }) => {
      handleAnswer(data.answer, data.senderClientId);
    });

    socket.on('webrtc-ice-candidate', (data: { candidate: RTCIceCandidateInit; senderClientId: string }) => {
      handleIceCandidate(data.candidate, data.senderClientId);
    });

    socket.on('user-left', handleUserLeft);

    // Listen for participants who joined with media - create offer TO them
    socket.on('participant-joined-media', (data: { clientId: string; userId: string; hasVideo: boolean; hasAudio: boolean }) => {
      // Don't connect to self
      if (data.clientId === clientId) return;
      
      console.log(`Participant ${data.clientId} has media, creating offer...`);
      
      // Create offer regardless of whether we have local media
      // They may want to send their media to us
      createOffer(data.clientId);
    });

    // Also listen to user-joined to initiate WebRTC if we have media
    socket.on('user-joined', (data: { clientId: string; userId: string }) => {
      if (data.clientId === clientId) return;
      
      // Create offer to new participant regardless of whether we have local media
      console.log(`New user ${data.clientId} joined, creating offer...`);
      createOffer(data.clientId);
    });

    return () => {
      socket.off('webrtc-offer', handleOffer as any);
      socket.off('webrtc-answer', handleAnswer as any);
      socket.off('webrtc-ice-candidate', handleIceCandidate as any);
      socket.off('user-left', handleUserLeft);
      socket.off('participant-joined-media');
      socket.off('user-joined');
    };
  }, [socket, clientId, handleOffer, handleAnswer, handleIceCandidate, handleUserLeft, createOffer, mediaManager]);

  // Clean up all peers on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(peer => {
        try {
          peer.connection.close();
        } catch (e) {
          // Ignore close errors
        }
      });
      peersRef.current = [];
      isInitiatorRef.current.clear();
    };
  }, []);

  return { 
    peers, 
    createOffer, 
    handleOffer, 
    handleAnswer, 
    handleIceCandidate,
    connectionStates 
  };
}