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
  
  const pageA = await context.newPage();
  await pageA.goto(`${API_URL}/classroom/packet-a`);
  await pageA.waitForTimeout(3000);
  
  const pageB = await context.newPage();
  await pageB.goto(`${API_URL}/classroom/packet-b`);
  await pageB.waitForTimeout(3000);

  // Test: Check for livekit config
  const hasLivekitConfig = await pageA.evaluate(() => {
    return !!window.rtcConfig;
  });
  console.log('Has RTC config:', hasLivekitConfig);

  // Test: Check ICE candidates in SDP
  await pageA.evaluate(() => {
    // Check if we can access livekit client
    console.log('livekit-client version:', window.livekitClientVersion || 'not found');
  });

  // Test: getStats regardless of track
  await pageA.evaluate(async () => {
    if (window.pc) {
      const stats = await window.pc.getStats();
      let hasVideo = false;
      let bytes = 0;
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.selected) {
          console.log('Selected candidate pair:', {
            state: report.state,
            nominated: report.nominated,
            bytesSent: report.bytesSent,
            bytesReceived: report.bytesReceived
          });
        }
      });
    }
  });

  await pageA.waitForTimeout(2000);
  await pageB.waitForTimeout(2000);

  // Final: Check bytesReceived via getStats on pageB with any connection
  await pageB.evaluate(async () => {
    if (window.pc2) {
      const stats = await window.pc2.getStats();
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          console.log('Inbound video track bytesReceived:', report.bytesReceived);
        }
      });
    }
  });

  await browser.close();
})();
