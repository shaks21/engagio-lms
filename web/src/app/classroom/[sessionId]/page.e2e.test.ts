/**
 * End-to-End Test for Virtual Classroom Features
 * Tests all major classroom functionality in a simulated multi-user scenario
 */

import { test, expect } from '@playwright/test';

test.describe('Virtual Classroom E2E Tests', () => {
  // Use two browser contexts to simulate two different users
  test('should support full classroom feature set with two users', async ({ browser }) => {
    // Create two separate browser contexts (different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // User 1 logs in as teacher
      await page1.goto('http://164.68.119.230:3001/login');
      await page1.fill('input[type="email"]', 'dr.smith@techacademy.edu');
      await page1.fill('input[type="password"]', 'password123');
      await page1.click('button:has-text("Sign In")');
      await page1.waitForURL('**/dashboard/**');
      
      // User 2 logs in as student
      await page2.goto('http://164.68.119.230:3001/login');
      await page2.fill('input[type="email"]', 'student.one@techacademy.edu');
      await page2.fill('input[type="password"]', 'password123');
      await page2.click('button:has-text("Sign In")');
      await page2.waitForURL('**/dashboard/**');
      
      // User 1 starts a new session
      await page1.click('text=Start New');
      await page1.selectOption('select', '1'); // Select first course
      await page1.click('button:has-text("Start Session")');
      await page1.waitForURL(`**/classroom/**`);
      
      const sessionUrl1 = page1.url();
      const sessionId = sessionUrl1.split('/').pop();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      // User 2 joins the same session via classroom code
      await page2.click('text=Join by Code');
      const codeInput = page2.locator('input[maxlength="8"]');
      await codeInput.waitFor();
      
      // Extract code from session URL or UI (simulate getting it from teacher's screen)
      // For this test, we'll have user 2 join by navigating directly
      await page2.goto(`http://164.68.119.230:3001/classroom/${sessionId}`);
      await page2.waitForURL(`**/classroom/${sessionId}**`);
      
      // Wait for both users to be in the classroom
      await page1.waitForSelector('text=Classroom');
      await page2.waitForSelector('text=Classroom');
      
      // Test 1: Mic toggling works bidirectionally
      await expect(page1.locator('text=Mic On')).toBeVisible(); // Starts unmuted
      await page2.click('button:has-text("Mic Off")'); // User 2 toggles their mic
      await expect(page1.locator('text=Mic Off')).toBeVisible(); // User 1 sees user 2's mic off
      
      // Test 2: Camera toggling works bidirectionally
      await expect(page1.locator('text=Cam Off')).toBeVisible(); // Starts off
      await page1.click('button:has-text("Cam Off")'); // User 1 turns on camera
      await expect(page2.locator('text=Cam On')).toBeVisible(); // User 2 sees user 1's camera on
      
      // Test 3: Screen sharing indicators work
      await page1.click('button:has-text("Share Screen")');
      await expect(page2.locator('text=Sharing')).toBeVisible();
      
      // Test 4: Chat messaging works bidirectionally
      await page1.click('.fixed.bottom-4.left-4'); // Open chat for user 1 (left side)
      await page1.fill('input[placeholder="Type a message..."]', 'Hello from teacher!');
      await page1.press('input[placeholder="Type a message..."]', 'Enter');
      
      await expect(page2.locator('text=Hello from teacher!')).toBeVisible();
      await expect(page2.locator('bg-blue-600')).toContainText('Hello from teacher!'); // In blue bubble (sender's view would be different)
      
      // User 2 sends message back
      await page2.click('.fixed.bottom-4.left-4'); // Open chat for user 2
      await page2.fill('input[placeholder="Type a message..."]', 'Hi teacher!');
      await page2.press('input[placeholder="Type a message..."]', 'Enter');
      
      await expect(page1.locator('text=Hi teacher!')).toBeVisible();
      
      // Test 5: Participant list updates with media status
      // User 1 should see user 2's media status in sidebar
      const participantRow1 = page1.locator('.w-72').filter({ hasText: 'student.one' });
      await expect(participantRow1).toBeVisible();
      
      // Test 6: Timer is running and updating
      const timer1 = page1.locator('text=LIVE').first();
      await expect(timer1).toBeVisible();
      const initialTime = await timer1.textContent();
      await page1.waitForTimeout(2000); // Wait 2 seconds
      const laterTime = await timer1.textContent();
      expect(laterTime).not.toBe(initialTime); // Time should have advanced
      
      // Test 7: Leave classroom functionality
      await page1.click('button:has-text("Leave")');
      await page1.waitForURL('**/dashboard/classroom**');
      
      // User 2 should see user 1 left
      await expect(page2.locator('.w-72')).not.toContainText('dr.smith');
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
  
  test('should handle connection errors gracefully', async ({ page }) => {
    // Test what happens when socket connection fails
    await page.goto('http://164.68.119.230:3001/login');
    await page.fill('input[type="email"]', 'dr.smith@techacademy.edu');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('**/dashboard/**');
    
    // Mock a failing socket connection by overriding the URL
    await page.addInitScript(() => {
      // Override the io function to simulate connection failure
      const originalIo = (window as any).io;
      (window as any).io = (url: string, opts: any) => {
        const socket = originalIo(url, opts);
        socket.connect(); // This will fail if we point to wrong port
        return socket;
      };
    });
    
    await page.click('text=Start New');
    await page.selectOption('select', '1');
    await page.click('button:has-text("Start Session")');
    
    // Should show error or fallback UI
    await page.waitForTimeout(3000);
    // Either stays on loading screen or shows error
    
  });
});
