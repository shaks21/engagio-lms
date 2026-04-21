const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    permissions: ['camera', 'microphone'],
  });

  const API_URL = 'http://164.68.119.230:3001';
  
  // Page A: Publisher
  const pageA = await context.newPage();
  await pageA.goto(`${API_URL}/classroom/packet-a`);
  await pageA.waitForTimeout(3000);
  
  // Page B: Subscriber
  const pageB = await context.newPage();
  await pageB.goto(`${API_URL}/classroom/packet-b`);
  await pageB.waitForTimeout(3000);

  // --- ICE State Check ---
  console.log('\n=== ICE CONNECTION STATE ===');
  const iceA = await pageA.evaluate(() => window.peerConnection ? window.peerConnection.iceConnectionState : 'NO_PC');
  const iceB = await pageB.evaluate(() => window.peerConnection ? window.peerConnection.iceConnectionState : 'NO_PC');
  console.log('Page A ICE:', iceA);
  console.log('Page B ICE:', iceB);

  await pageA.waitForTimeout(5000);
  await pageB.waitForTimeout(5000);

  const iceAFinal = await pageA.evaluate(() => window.peerConnection ? window.peerConnection.iceConnectionState : 'NO_PC');
  const iceBFinal = await pageB.evaluate(() => window.peerConnection ? window.peerConnection.iceConnectionState : 'NO_PC');
  console.log('After 5s - Page A ICE:', iceAFinal);
  console.log('After 5s - Page B ICE:', iceBFinal);

  if (iceAFinal === 'checking' || iceAFinal === 'failed' || iceBFinal === 'checking' || iceBFinal === 'failed') {
    console.log('\n\u26a0\ufe0f ICE checking/failed - UDP ports likely blocked!');
  }

  // --- Bitrate Validation (10s) ---
  console.log('\n=== BITRATE VALIDATION (10s) ===');
  
  await pageB.evaluate(() => {
    window.bytesHistory = [];
    window.startT = Date.now();
    if (window.peerConnection && window.videoTrack) {
      setInterval(async () => {
        try {
          const st = await window.peerConnection.getStats();
          let br = 0;
          st.forEach(r => {
            if (r.type === 'inbound-rtp' && r.kind === 'video') br += (r.bytesReceived || 0);
          });
          window.bytesHistory.push({t: Date.now() - window.startT, b: br});
        } catch(e) {}
      }, 1000);
    }
  });

  await pageB.waitForTimeout(10000);

  const bytesData = await pageB.evaluate(() => window.bytesHistory || []);
  console.log('BytesReceived history:', JSON.stringify(bytesData));
  
  const startBytes = bytesData.length ? bytesData[0].b : 0;
  const endBytes = bytesData.length ? bytesData[bytesData.length-1].b : 0;
  const delta = endBytes - startBytes;

  console.log(`\nStart: ${startBytes}, End: ${endBytes}, Delta: ${delta}`);
  
  if (delta === 0) {
    console.log('\n\ud83d\udea8 CRITICAL: bytesReceived=0 - FIREWALL IS BLOCKING UDP 50000-60000');
    console.log('\n--- UNBLOCK COMMANDS ---');
    console.log('sudo ufw allow 50000:60000/udp');
    console.log('sudo iptables -A INPUT -p udp --dport 50000:60000 -j ACCEPT');
    console.log('sudo iptables -A OUTPUT -p udp --sport 50000:60000 -j ACCEPT');
  } else {
    console.log('\n\u2705 Media flowing - UDP open');
  }

  await browser.close();
})();
