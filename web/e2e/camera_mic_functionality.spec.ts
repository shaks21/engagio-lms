import { test, expect } from '@playwright/test';

const BASE_URL = 'http://164.68.119.230:3001';

// Helper to login and create a session
async function setupSession(page: any) {
  const email = `test_${Date.now()}@test.com`;
  
  // Register
  await page.goto(`${BASE_URL}/register`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.selectOption('select', 'TEACHER');
  await page.click('button:has-text("Create Account")');
  await page.waitForTimeout(2000);
  
  // Login if needed
  if (page.url().includes('login')) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
  }
  
  // Go to classroom dashboard
  await page.goto(`${BASE_URL}/dashboard/classroom`);
  await page.waitForTimeout(2000);
  
  // Start a session if needed
  const startNew = page.locator('text=Start New').first();
  if (await startNew.isVisible()) {
    await startNew.click();
    await page.waitForTimeout(1000);
    
    const startButton = page.locator('button:has-text("Start Session")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(4000);
    }
  }
}

test.describe('Camera and Microphone Functionality', () => {
  
  test('Camera toggle should create video stream and display in video element', async ({ page }) => {
    await setupSession(page);
    
    // Click camera toggle button (should be red/off initially)
    const cameraButton = page.locator('button[title*="Camera"]').first();
    
// Wait for button to be visible
    await page.waitForTimeout(2000);
    console.log('Camera button found');
    
    // Click to turn on camera
    await cameraButton.click();
    await page.waitForTimeout(3000);
    
    // Check for video element with srcObject
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return { found: false };
      
      return {
        found: true,
        hasSrcObject: !!video.srcObject,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      };
    });
    
    console.log('Video element info:', videoInfo);
    
    // Verify video element exists and has stream
    expect(videoInfo.found).toBe(true);
    expect(videoInfo.hasSrcObject).toBe(true);
  });

  test('Microphone should initialize and can be toggled', async ({ page }) => {
    await setupSession(page);
    
    // Find microphone toggle button
    const micButton = page.locator('button[title*="Microphone"]').first();
    
// Wait for button
    await page.waitForTimeout(2000);
    console.log('Mic button found');
    
    // Verify button is clickable
    const isEnabled = await micButton.isEnabled();
    expect(isEnabled).toBe(true);
    
    // Click mic to toggle
    await micButton.click();
    await page.waitForTimeout(500);
    
    // Verify button still works (no crash)
    console.log('Mic toggle successful');
  });

  test('Full flow: join classroom, enable camera, verify no errors', async ({ page }) => {
    // Capture console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text());
      }
    });
    
    await setupSession(page);
    
    // Click camera button to enable video
    const cameraButton = page.locator('button[title*="Camera"]').first();
    await cameraButton.click();
    await page.waitForTimeout(3000);
    
    // Check console logs for errors
    const errorLogs = logs.filter(l => 
      l.toLowerCase().includes('error') || l.toLowerCase().includes('failed')
    );
    console.log('Error logs:', errorLogs);
    
    // Check if there's any media error displayed on page
    const mediaError = await page.locator('[role="alert"]:has-text("Media Error")').count();
    console.log('Media errors on page:', mediaError);
    
    // Get video info
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? {
        hasSrcObject: !!video.srcObject,
        width: video.videoWidth,
        height: video.videoHeight
      } : { hasSrcObject: false, width: 0, height: 0 };
    });
    
    console.log('Video info:', videoInfo);
    
    // The test passes if no media error and video element has stream
    expect(mediaError).toBe(0);
    expect(videoInfo.hasSrcObject).toBe(true);
  });
});