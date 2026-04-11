'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

type PeerConnection = {
  peerId: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
};

type UseWebRTCOptions = {
  socket: Socket | null;
  sessionId: string;
  localStream: MediaStream | null;
  clientId: string;
};

export function useWebRTC({ socket, sessionId, localStream, clientId }: UseWebRTCOptions) {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  
  // ICE servers configuration (using Google's public STUN servers)
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Create a new peer connection
  const createPeerConnection = useCallback((peerId: string, isInitiator: boolean): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers });

    // Add local tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received remote track from', peerId, event.streams[0]?.getTracks().length);
      const remoteStream = event.streams[0] || new MediaStream();
      
      // Update peers state
      const existingPeer = peersRef.current.get(peerId);
      if (existingPeer) {
        existingPeer.remoteStream = remoteStream;
        peersRef.current.set(peerId, existingPeer);
      } else {
        peersRef.current.set(peerId, {
          peerId,
          connection: pc,
          remoteStream,
        });
      }
      
      // Trigger re-render
      setPeers(new Map(peersRef.current));
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

    pc.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        // Clean up peer connection
        pc.close();
        peersRef.current.delete(peerId);
        setPeers(new Map(peersRef.current));
      }
    };

    return pc;
  }, [localStream, socket, sessionId]);

  // Create offer (initiator side)
  const createOffer = useCallback(async (peerId: string) => {
    const pc = createPeerConnection(peerId, true);
    
    peersRef.current.set(peerId, {
      peerId,
      connection: pc,
      remoteStream: null,
    });
    setPeers(new Map(peersRef.current));

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket?.emit('webrtc-offer', {
        targetClientId: peerId,
        offer: pc.localDescription,
        sessionId,
      });
    } catch (err) {
      console.error('Failed to create offer:', err);
    }
  }, [createPeerConnection, socket, sessionId]);

  // Handle incoming offer (receiver side)
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, senderClientId: string) => {
    console.log('Received offer from', senderClientId);
    
    const pc = createPeerConnection(senderClientId, false);
    
    peersRef.current.set(senderClientId, {
      peerId: senderClientId,
      connection: pc,
      remoteStream: null,
    });
    setPeers(new Map(peersRef.current));

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket?.emit('webrtc-answer', {
        targetClientId: senderClientId,
        answer: pc.localDescription,
        sessionId,
      });
    } catch (err) {
      console.error('Failed to handle offer:', err);
    }
  }, [createPeerConnection, socket, sessionId]);

  // Handle incoming answer (initiator side)
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, senderClientId: string) => {
    console.log('Received answer from', senderClientId);
    
    const peer = peersRef.current.get(senderClientId);
    if (peer?.connection) {
      try {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Failed to handle answer:', err);
      }
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, senderClientId: string) => {
    console.log('Received ICE candidate from', senderClientId);
    
    const peer = peersRef.current.get(senderClientId);
    if (peer?.connection && candidate) {
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    }
  }, []);

  // Set up socket listeners for WebRTC signaling
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

    return () => {
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // When local stream changes, add tracks to all peer connections
  useEffect(() => {
    if (!localStream) return;
    
    peersRef.current.forEach((peer) => {
      const pc = peer.connection;
      // Replace sender tracks with new stream
      const senders = pc.getSenders();
      const tracks = localStream.getTracks();
      
      senders.forEach((sender, index) => {
        if (tracks[index]) {
          sender.replaceTrack(tracks[index]);
        }
      });
    });
  }, [localStream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
      peersRef.current.clear();
      setPeers(new Map());
    };
  }, []);

  return {
    peers: Array.from(peers.values()),
    createOffer,
  };
}