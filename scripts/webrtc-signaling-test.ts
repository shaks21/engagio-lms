/**
 * WebRTC Signaling Test Script
 * 
 * This script simulates two socket clients connecting to the classroom
 * and performs a WebRTC handshake to verify signaling works correctly.
 * 
 * Usage: npx ts-node scripts/webrtc-signaling-test.ts
 */

import { io, Socket } from 'socket.io-client';
import { RTCPeerConnection, RTCSessionDescription } from 'wrtc';

const SESSION_ID = '078bade2-adc4-477d-8fe9-0e3bcabb2fc0';
const SOCKET_URL = 'http://127.0.0.1:3000/classroom';

// ICE servers (same as frontend)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface TestClient {
  socket: Socket;
  clientId?: string;
  peerConnection?: RTCPeerConnection;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestClient(name: string): Promise<TestClient> {
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    reconnection: false,
  });

  return new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`[${name}] Connected with socket ID: ${socket.id}`);
      
      // Join classroom
      socket.emit('joinClassroom', {
        tenantId: 'acc76003-91a6-4773-941e-691b465fb53d',
        sessionId: SESSION_ID,
        courseId: '',
        userId: `${name.toLowerCase()}@test.com`,
        classroomCode: SESSION_ID,
        userName: name,
      });

      socket.on('classroom-joined', (data: any) => {
        console.log(`[${name}] Joined classroom. Client ID: ${data.clientId}`);
        resolve({ socket, clientId: data.clientId });
      });

      socket.on('connect_error', (err) => {
        console.error(`[${name}] Connection error:`, err.message);
        reject(err);
      });
    });

    // Timeout after 10 seconds
    setTimeout(() => reject(new Error('Connection timeout')), 10000);
  });
}

async function runWebRTCHandshake() {
  console.log('\n=== Starting WebRTC Signaling Test ===\n');

  let clientA: TestClient;
  let clientB: TestClient;

  try {
    // Create two clients
    console.log('Creating Client A...');
    clientA = await createTestClient('Alice');
    await sleep(500);

    console.log('Creating Client B...');
    clientB = await createTestClient('Bob');
    await sleep(500);

    // Determine which is polite (smaller clientId)
    const isAPolite = clientA.clientId! < clientB.clientId!;
    console.log(`\nPolite peer: ${isAPolite ? 'Alice' : 'Bob'} (clientId: ${isAPolite ? clientA.clientId : clientB.clientId})`);
    console.log(`Impolite peer: ${!isAPolite ? 'Alice' : 'Bob'} (clientId: ${!isAPolite ? clientA.clientId : clientB.clientId})\n`);

    // Create peer connections
    console.log('Creating RTCPeerConnection for Alice...');
    clientA.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    console.log('Creating RTCPeerConnection for Bob...');
    clientB.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add ICE handlers
    clientA.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Alice] ICE candidate generated, sending to Bob...');
        clientA.socket.emit('webrtc-ice-candidate', {
          targetClientId: clientB.clientId,
          candidate: event.candidate,
          sessionId: SESSION_ID,
        });
      }
    };

    clientB.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[Bob] ICE candidate generated, sending to Alice...');
        clientB.socket.emit('webrtc-ice-candidate', {
          targetClientId: clientA.clientId,
          candidate: event.candidate,
          sessionId: SESSION_ID,
        });
      }
    };

    // Track handling
    clientA.peerConnection.ontrack = (event) => {
      console.log('[Alice] Received track from Bob!', {
        streams: event.streams.length,
        trackKind: event.track.kind,
      });
    };

    clientB.peerConnection.ontrack = (event) => {
      console.log('[Bob] Received track from Alice!', {
        streams: event.streams.length,
        trackKind: event.track.kind,
      });
    };

    // ICE connection state
    clientA.peerConnection.oniceconnectionstatechange = () => {
      console.log(`[Alice] ICE connection state: ${clientA.peerConnection!.iceConnectionState}`);
    };

    clientB.peerConnection.oniceconnectionstatechange = () => {
      console.log(`[Bob] ICE connection state: ${clientB.peerConnection!.iceConnectionState}`);
    };

    // Signaling state
    clientA.peerConnection.onsignalingstatechange = () => {
      console.log(`[Alice] Signaling state: ${clientA.peerConnection!.signalingState}`);
    };

    clientB.peerConnection.onsignalingstatechange = () => {
      console.log(`[Bob] Signaling state: ${clientB.peerConnection!.signalingState}`);
    };

    // Handle incoming offers
    clientA.socket.on('webrtc-offer', async (data: any) => {
      console.log('[Alice] Received offer from Bob');
      await clientA.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await clientA.peerConnection!.createAnswer();
      await clientA.peerConnection!.setLocalDescription(answer);
      clientA.socket.emit('webrtc-answer', {
        targetClientId: data.senderClientId,
        answer: clientA.peerConnection!.localDescription,
        sessionId: SESSION_ID,
      });
      console.log('[Alice] Sent answer to Bob');
    });

    clientB.socket.on('webrtc-offer', async (data: any) => {
      console.log('[Bob] Received offer from Alice');
      await clientB.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await clientB.peerConnection!.createAnswer();
      await clientB.peerConnection!.setLocalDescription(answer);
      clientB.socket.emit('webrtc-answer', {
        targetClientId: data.senderClientId,
        answer: clientB.peerConnection!.localDescription,
        sessionId: SESSION_ID,
      });
      console.log('[Bob] Sent answer to Alice');
    });

    // Handle incoming answers
    clientA.socket.on('webrtc-answer', async (data: any) => {
      console.log('[Alice] Received answer from Bob');
      await clientA.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    clientB.socket.on('webrtc-answer', async (data: any) => {
      console.log('[Bob] Received answer from Alice');
      await clientB.peerConnection!.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    // Handle ICE candidates from other clients
    clientA.socket.on('webrtc-ice-candidate', async (data: any) => {
      console.log('[Alice] Received ICE candidate from', data.senderClientId);
      if (data.candidate) {
        await clientA.peerConnection!.addIceCandidate(data.candidate);
      }
    });

    clientB.socket.on('webrtc-ice-candidate', async (data: any) => {
      console.log('[Bob] Received ICE candidate from', data.senderClientId);
      if (data.candidate) {
        await clientB.peerConnection!.addIceCandidate(data.candidate);
      }
    });

    // Alice creates offer (she's the initiator based on lexicographic comparison if her ID is smaller)
    // Wait a bit for both to be ready
    await sleep(1000);

    console.log('\n--- Alice creating offer ---');
    const offer = await clientA.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await clientA.peerConnection.setLocalDescription(offer);

    clientA.socket.emit('webrtc-offer', {
      targetClientId: clientB.clientId,
      offer: clientA.peerConnection.localDescription,
      sessionId: SESSION_ID,
    });
    console.log('[Alice] Sent offer to Bob');

    // Wait for connection
    console.log('\n--- Waiting for WebRTC connection... ---');
    await sleep(5000);

    // Check final states
    console.log('\n=== Final States ===');
    console.log(`Alice - Signaling: ${clientA.peerConnection.signalingState}, ICE: ${clientA.peerConnection.iceConnectionState}`);
    console.log(`Bob - Signaling: ${clientB.peerConnection.signalingState}, ICE: ${clientB.peerConnection.iceConnectionState}`);

    if (clientA.peerConnection.iceConnectionState === 'connected' || 
        clientA.peerConnection.iceConnectionState === 'completed') {
      console.log('\n✅ WebRTC Signaling Test PASSED!');
    } else {
      console.log('\n⚠️ WebRTC connection not established yet. ICE state may take more time.');
      await sleep(5000);
      console.log(`After additional wait - Alice ICE: ${clientA.peerConnection.iceConnectionState}, Bob ICE: ${clientB.peerConnection.iceConnectionState}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    if (clientA?.peerConnection) clientA.peerConnection.close();
    if (clientB?.peerConnection) clientB.peerConnection.close();
    if (clientA?.socket) clientA.socket.disconnect();
    if (clientB?.socket) clientB.socket.disconnect();
    process.exit(0);
  }
}

runWebRTCHandshake();
