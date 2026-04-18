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
  
  // Polite peer: The peer with lexicographically SMALLER clientId is "polite"
  // They will yield when there's an offer collision
  const isPoliteRef = useRef<Record<string, boolean>>({});
  
  // Track pending local offers to detect collisions
  const pendingLocalOfferRef = useRef<Set<string>>(new Set());

  // ICE servers - STUN only for now (TURN can cause crashes if server unavailable)
  const iceServers: RTCIceServer[] = useMemo(() => [
    // Google STUN servers - reliable and free
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ], []);

  const createPeerConnection = useCallback((peerId: string, initiator: boolean = true): RTCPeerConnection => {
    // Wrap RTCPeerConnection constructor in try-catch to prevent crashes from bad ICE servers
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers });
    } catch (err) {
      console.error(`❌ Failed to create RTCPeerConnection for ${peerId}:`, err);
      // Fallback to empty config (let browser use default STUN)
      console.log('🔄 Retrying with empty ICE servers config...');
      pc = new RTCPeerConnection({});
    }

    // Determine polite peer status - smaller clientId is polite
    const myId = clientId || '';
    const isPolite = myId < peerId;  // Smaller ID = polite
    isPoliteRef.current[peerId] = isPolite;
    console.log(`Peer ${peerId}: ${isPolite ? 'POLITE (will yield)' : 'IMPOLITE (will insist)'}, myId=${myId}`);

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
      
      // Detailed ICE state logging
      console.log(`🔗 ICE Connection State for ${peerId}: ${state}`, {
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState,
        connectionState: pc.connectionState,
      });
      
      if (pc.iceConnectionState === 'failed') {
        console.warn(`⚠️ ICE FAILED for peer ${peerId} - attempting ICE restart...`);
        
        // STEP 1: Attempt ICE restart before giving up
        try {
          pc.restartIce();
          console.log(`🔄 ICE restart triggered for ${peerId}`);
        } catch (err) {
          console.error(`❌ ICE restart failed for ${peerId}:`, err);
        }
        
        // Schedule reconnection attempt if ICE restart doesn't work
        const attempts = reconnectionAttempts.current[peerId] || 0;
        if (attempts < 3) {
          reconnectionAttempts.current = { ...reconnectionAttempts.current, [peerId]: attempts + 1 };
          setTimeout(() => {
            const stream = mediaManager.getStream();
            if (stream && stream.getTracks().length > 0) {
              setConnectionStates((prev) => ({ ...prev, [peerId]: 'connecting' }));
            }
          }, 1000 * Math.min(2 ** attempts, 10));
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn(`⚠️ ICE DISCONNECTED for peer ${peerId} - will retry...`);
        // Don't close immediately on disconnect - wait for potential reconnection
        const attempts = reconnectionAttempts.current[peerId] || 0;
        if (attempts < 3) {
          reconnectionAttempts.current = { ...reconnectionAttempts.current, [peerId]: attempts + 1 };
          setTimeout(() => {
            if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
              const stream = mediaManager.getStream();
              if (stream && stream.getTracks().length > 0) {
                setConnectionStates((prev) => ({ ...prev, [peerId]: 'connecting' }));
              }
            }
          }, 1000 * Math.min(2 ** attempts, 10));
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Log the type of ICE candidate being generated
        const candidate = event.candidate;
        const candidateType = candidate.type; // 'host', 'srflx', or 'relay'
        const candidateIP = candidate.address;
        const candidatePort = candidate.port;
        const candidateProtocol = candidate.protocol; // 'udp' or 'tcp'
        const candidateFoundation = candidate.foundation;
        
        console.log(`🧊 ICE Candidate for ${peerId}:`, {
          type: candidateType,
          ip: candidateIP,
          port: candidatePort,
          protocol: candidateProtocol,
          foundation: candidateFoundation,
          ttl: candidate.candidate,
        });
        
        // Emit the candidate over socket
        if (socket) {
          socket.emit('webrtc-ice-candidate', {
            targetClientId: peerId,
            candidate: event.candidate,
            sessionId,
          });
        }
        
        // Alert if we're only seeing host candidates (won't work across internet)
        if (candidateType === 'host') {
          console.warn(`⚠️ Only HOST candidate found for ${peerId}. Need srflx (STUN) or relay (TURN) for internet connectivity.`);
        }
      }
    };

    // Handle incoming tracks - CRITICAL: Proper stream mapping
    // This is assigned when RTCPeerConnection is created (not just during offer/answer)
    pc.ontrack = (event) => {
      // Log to verify browser actually sees the incoming track
      console.log(`🔥 RECEIVED REMOTE TRACK: ${event.track?.kind} FROM: ${peerId}`, {
        trackId: event.track?.id,
        streams: event.streams.map(s => s.id),
      });
      
      // Handle stream reconstruction
      let remoteStream: MediaStream;
      
      // Check if we already have a stream for this peer
      const existingPeer = peersRef.current.find(p => p.peerId === peerId);
      if (existingPeer?.remoteStream) {
        // Stream exists - add the new track to it
        console.log(`➕ Adding track to existing stream for ${peerId}`);
        remoteStream = existingPeer.remoteStream;
        remoteStream.addTrack(event.track!);
      } else {
        // Create new stream with the track
        console.log(`🆕 Creating new stream for ${peerId} with track`);
        remoteStream = new MediaStream([event.track!]);
      }
      
      // Mark the stream with peerId for identification
      (remoteStream as any).peerId = peerId;

      // Use functional update to ensure we have the latest state
      setPeers((prev) => {
        const existingIndex = prev.findIndex((p) => p.peerId === peerId);
        const newStream = remoteStream || new MediaStream();
        
        if (existingIndex >= 0) {
          // Update existing peer with new stream
          console.log(`🔄 Updating existing peer ${peerId} with remote stream`);
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            remoteStream: newStream,
            connectionState: 'connected',
          };
          return updated;
        }
        // Add new peer
        console.log(`➕ Adding new peer ${peerId} with remote stream`);
        return [...prev, { 
          peerId, 
          connection: pc, 
          remoteStream: newStream, 
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

  // Create offer to a specific peer - ALWAYS create new offer for re-negotiation
  // This enables adding tracks after initial connection is established
  const createOffer = useCallback(
    async (targetClientId: string) => {
      // Get existing peer connection or create new one
      let pc: RTCPeerConnection | undefined;
      let existingPeer = peersRef.current.find(p => p.peerId === targetClientId);
      
      if (existingPeer?.connection) {
        // Reuse existing connection but force new negotiation
        pc = existingPeer.connection;
        console.log(`♻️ Reusing existing peer connection for ${targetClientId}, initiating re-negotiation...`);
        
        // Mark as initiator so we can create new offers
        isInitiatorRef.current.add(targetClientId);
        
        // Add any new local tracks that might not be sent yet
        const localStream = mediaManager.getStream();
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            // Check if track is already sent
            const senders = pc!.getSenders();
            const hasTrack = senders.some(s => s.track?.id === track.id);
            if (!hasTrack) {
              console.log(`➕ Adding new track to existing peer: ${track.kind}`);
              pc!.addTrack(track, localStream);
            }
          });
        }
        
        // Mark pending offer
        pendingLocalOfferRef.current.add(targetClientId);
        
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          
          socket?.emit('webrtc-offer', {
            targetClientId,
            offer: pc.localDescription,
            sessionId,
          });
          console.log(`📤 Sent re-negotiation offer to ${targetClientId}`);
        } catch (err) {
          console.error('Failed to create re-negotiation offer:', err);
        }
        return;
      }
      
      // No existing connection - create new one
      // Mark that we have a pending local offer
      pendingLocalOfferRef.current.add(targetClientId);
      
      console.log(`📤 Creating NEW WebRTC offer to ${targetClientId}`);
      pc = createPeerConnection(targetClientId, true);
      
      setPeers((prev) => [...prev.filter((p) => p.peerId !== targetClientId), {
        peerId: targetClientId,
        connection: pc,
        remoteStream: null,
        connectionState: 'connecting',
      }]);
      setConnectionStates((prev) => ({ ...prev, [targetClientId]: 'connecting' }));

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        
        socket?.emit('webrtc-offer', {
          targetClientId,
          offer: pc.localDescription,
          sessionId,
        });
        console.log(`📤 Sent initial offer to ${targetClientId}`);
      } catch (err) {
        console.error('Failed to create offer:', err);
        setConnectionStates((prev) => ({ ...prev, [targetClientId]: 'failed' }));
      }
    },
    [createPeerConnection, socket, sessionId, mediaManager]
  );

  // Handle incoming offer - with Perfect Negotiation (Polite Peer) support
  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit, senderClientId: string) => {
      console.log(`📥 Handling offer from ${senderClientId}`);
      
      // Get the peer connection if it exists
      let pc: RTCPeerConnection;
      let existingPeer = peersRef.current.find(p => p.peerId === senderClientId);
      
      // Check signaling state for offer collision handling
      // Polite peer must rollback their local offer and accept remote
      let needsToProcessOffer = true;
      
      if (existingPeer?.connection && existingPeer.connection.signalingState !== 'stable') {
        console.log(`⚠️ Offer collision detected! signalingState: ${existingPeer.connection.signalingState}`);
        
        // If we're the polite peer, we yield - rollback local offer and accept remote
        if (isPoliteRef.current[senderClientId]) {
          console.log(`🤝 POLITE PEER YIELDING: Rolling back local offer, accepting remote from ${senderClientId}`);
          
          // Rollback: close the connection and start fresh as answerer
          existingPeer.connection.close();
          
          // Remove from refs
          peersRef.current = peersRef.current.filter(p => p.peerId !== senderClientId);
          setPeers(prev => prev.filter(p => p.peerId !== senderClientId));
          isInitiatorRef.current.delete(senderClientId);
          pendingLocalOfferRef.current.delete(senderClientId);
          existingPeer = undefined;
          
          // Proceed to process the incoming offer as answerer
          needsToProcessOffer = true;
        } else {
          // Impolite peer - we keep our offer, ignore the remote one
          console.log(`✊ IMPOLITE PEER INSISTING: Keeping local offer, ignoring remote from ${senderClientId}`);
          needsToProcessOffer = false;
        }
      }
      
      if (!needsToProcessOffer) {
        return;
      }
      
      // Clean up existing peer connection if any
      if (existingPeer) {
        existingPeer.connection.close();
        peersRef.current = peersRef.current.filter(p => p.peerId !== senderClientId);
        setPeers(prev => prev.filter(p => p.peerId !== senderClientId));
      }
      
      // Clear pending offer flag
      pendingLocalOfferRef.current.delete(senderClientId);
      
      // Create peer connection as answerer (not initiator)
      pc = createPeerConnection(senderClientId, false);
      
      setPeers((prev) => [...prev.filter((p) => p.peerId !== senderClientId), {
        peerId: senderClientId,
        connection: pc,
        remoteStream: null,
        connectionState: 'connecting',
      }]);
      setConnectionStates((prev) => ({ ...prev, [senderClientId]: 'connecting' }));

      try {
        // Check signalingState before setting remote description
        if (pc.signalingState !== 'stable') {
          console.warn(`⚠️ Cannot set remote description - signalingState is ${pc.signalingState}, waiting...`);
          // Wait for the state to become stable
          await new Promise<void>((resolve) => {
            const checkState = () => {
              if (pc.signalingState === 'stable') {
                pc.removeEventListener('signalingstatechange', checkState);
                resolve();
              }
            };
            pc.addEventListener('signalingstatechange', checkState);
            // Timeout after 5 seconds
            setTimeout(() => {
              pc.removeEventListener('signalingstatechange', checkState);
              resolve();
            }, 5000);
          });
        }
        
        console.log(`📝 Setting remote description for ${senderClientId}, signalingState: ${pc.signalingState}`);
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
        // Clear pending offer flag
        pendingLocalOfferRef.current.delete(senderClientId);
        
        // Check signalingState before setting remote description
        if (peer.connection.signalingState !== 'stable') {
          console.log(`📥 Handling answer for ${senderClientId}, signalingState: ${peer.connection.signalingState}`);
        }
        
        peer.connection.setRemoteDescription(new RTCSessionDescription(answer))
          .then(() => {
            console.log(`✅ Remote description set for ${senderClientId}`);
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
        console.log(`🧊 Adding ICE candidate from ${senderClientId}:`, candidate ? candidate.candidate : 'null');
        peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
          .then(() => console.log(`✅ ICE candidate added from ${senderClientId}`))
          .catch((err) => console.error('Failed to add ICE candidate:', err));
      } else {
        console.warn(`⚠️ No peer connection found for ICE candidate from ${senderClientId}`);
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