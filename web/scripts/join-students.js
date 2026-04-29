const { Room, RoomEvent, ConnectionState } = require('livekit-client');

const apiUrl = 'https://engagio.duckdns.org/api';
const sessionId = '565e42ef-fc1a-479e-86c5-42019a36c3e8';

async function login(email, password) {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

async function getToken(accessToken, sessionId) {
  const res = await fetch(`${apiUrl}/classroom/token/${sessionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.json();
}

async function studentJoinRoom(email, password, displayName) {
  const data = await login(email, password);
  const tokenData = await getToken(data.accessToken, sessionId);
  const token = tokenData.token;
  const url = tokenData.url || 'wss://engagio.duckdns.org';
  console.log(`[${email}] token received, connecting to ${url}`);

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  room.on(RoomEvent.Connected, () => {
    console.log(`[${email}] Connected to room`);
  });

  room.on(RoomEvent.Disconnected, () => {
    console.log(`[${email}] Disconnected from room`);
  });

  room.on(RoomEvent.ConnectionStateChanged, (state) => {
    console.log(`[${email}] State: ${state}`);
  });

  await room.connect(url, token);
  await room.localParticipant.setCameraEnabled(false);
  await room.localParticipant.setMicrophoneEnabled(false);
  console.log(`[${email}] Joined room with identity: ${room.localParticipant.identity}`);
  return room;
}

const students = [
  { email: 'manual.student.1.280426@engagio.local', password: 'TestPass123!', name: 'Student One' },
  { email: 'manual.student.2.280426@engagio.local', password: 'TestPass123!', name: 'Student Two' },
];

async function main() {
  const rooms = [];
  for (const s of students) {
    try {
      const room = await studentJoinRoom(s.email, s.password, s.name);
      rooms.push(room);
    } catch (err) {
      console.error(`[${s.email}] Failed to join:`, err.message);
    }
  }
  console.log(`All ${rooms.length} students connected to room. Keeping alive for 60 seconds...`);
  // Keep alive for 60 seconds to allow the test to proceed
  await new Promise(r => setTimeout(r, 60000));
  for (const room of rooms) {
    await room.disconnect();
  }
  console.log('Done. All students disconnected.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
