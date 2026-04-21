const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
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

  // Check for RTCPeerConnection availability
  const hasPC_A = await pageA.evaluate(() => !!window.RTCPeerConnection);
  const hasPC_B = await pageB.evaluate(() => !!window.RTCPeerConnection);
  console.log('RTCPeerConnection available A:', hasPC_A, 'B:', hasPC_B);

  // Setup peer connections with proper config
  const servers = {
    iceServers: [{ urls: 'stun:164.68.119.230:3478' }]
  };

  await pageA.evaluate((cfg) => {
    window.pc = new RTCPeerConnection(cfg);
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        stream.getTracks().forEach(t => window.pc.addTrack(t, stream));
        window.pc.onicecandidate = e => {
          if (e.candidate) {
            console.log('A candidate:', e.candidate.candidate);
          }
        };
      })
      .catch(e => console.error('getUserMedia error:', e));
  }, servers);

  await pageB.evaluate((cfg) => {
    window.pc2 = new RTCPeerConnection(cfg);
    window.pc2.ontrack = e => {
      window.remoteTrack = e.track;
      console.log('Remote track kind:', e.track.kind, 'readyState:', e.track.readyState);
    };
    window.pc2.onicecandidate = e => {
      if (e.candidate) {
        console.log('B candidate:', e.candidate.candidate);
      }
    };
  }, servers);

  await pageA.waitForTimeout(2000);
  
  // Create offer
  const offer = await pageA.evaluate(() => window.pc.createOffer());
  await pageA.evaluate(o => window.pc.setLocalDescription(o), offer);
  await pageB.evaluate(o => window.pc2.setRemoteDescription(o), offer);
  
  const answer = await pageB.evaluate(() => window.pc2.createAnswer());
  await pageB.evaluate(a => window.pc2.setLocalDescription(a), answer);
  await pageA.evaluate(a => window.pc.setRemoteDescription(a), answer);

  await pageA.waitForTimeout(5000);
  await pageB.waitForTimeout(5000);

  // === DETAILED ICE CHECK ===
  console.log('\n=== DETAILED ICE STATUS ===');
  const iceStateA = await pageA.evaluate(() => window.pc.iceConnectionState);
  const iceStateB = await pageB.evaluate(() => window.pc2.iceConnectionState);
  console.log('ICE State A:', iceStateA);
  console.log('ICE State B:', iceStateB);

  // Check gathered candidates
  const localDescA = await pageA.evaluate(() => window.pc.localDescription);
  const localDescB = await pageB.evaluate(() => window.pc2.localDescription);
  console.log('\nLocal description A:', localDescA.sdp ? localDescA.sdp.substring(0, 200) : localDescA);
  console.log('Local description B:', localDescB.sdp ? localDescB.sdp.substring(0, 200) : localDescB);

  // === BITRATE VALIDATION ===
  console.log('\n=== BITRATE VALIDATION (10s) ===');
  await pageB.evaluate(() => {
    window.bytesHistory = [];
    window.startT = Date.now();
    if (window.pc2 && window.remoteTrack) {
      setInterval(async () => {
        try {
          const stats = await window.pc2.getStats();
          let br = 0;
          stats.forEach(r => {
            if (r.type === 'inbound-rtp' && r.kind === 'video') {
              br += (r.bytesReceived || 0);
            }
          });
          window.bytesHistory.push({t: Date.now() - window.startT, b: br});
        } catch(e) { console.error(e); }
      }, 1000);
    }
  });

  await pageB.waitForTimeout(10000);

  const bytesData = await pageB.evaluate(() => window.bytesHistory || []);
  console.log('Bytes history:', JSON.stringify(bytesData));
  
  const startB = bytesData.length ? bytesData[0].b : 0;
  const endB = bytesData.length ? bytesData[bytesData.length-1].b : 0;
  const deltaB = endB - startB;
  console.log(`Delta bytes received: ${deltaB}`);

  if (deltaB === 0) {
    console.log('\n🚨 bytesReceived=0 — firewall blocking UDP or SFU not reachable');
  } else {
    console.log('\n✅ Media flowing — delta > 0');
  }

  await browser.close();
})();
