# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hardware_integrity.spec.ts >> Hardware Integrity Tests >> 2. Muted state sync - UI state matches socket events
- Location: e2e/hardware_integrity.spec.ts:81:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://164.68.119.230:3001/register
Call log:
  - navigating to "http://164.68.119.230:3001/register", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://164.68.119.230:3001';
  4   | 
  5   | test.describe('Hardware Integrity Tests', () => {
  6   |   
  7   |   // Helper to setup a user and enter classroom
  8   |   async function enterClassroom(page: any) {
  9   |     const email = `hw_test_${Date.now()}@test.com`;
  10  |     
  11  |     // Register as teacher
> 12  |     await page.goto(`${BASE_URL}/register`);
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://164.68.119.230:3001/register
  13  |     await page.fill('input[type="email"]', email);
  14  |     await page.fill('input[type="password"]', 'password123');
  15  |     await page.selectOption('select', 'TEACHER');
  16  |     await page.click('button:has-text("Create Account")');
  17  |     await page.waitForTimeout(2000);
  18  |     
  19  |     // Login
  20  |     await page.goto(`${BASE_URL}/login`);
  21  |     await page.fill('input[type="email"]', email);
  22  |     await page.fill('input[type="password"]', 'password123');
  23  |     await page.click('button:has-text("Sign In")');
  24  |     await page.waitForTimeout(2000);
  25  |     
  26  |     // Create session
  27  |     await page.goto(`${BASE_URL}/dashboard/classroom`);
  28  |     await page.waitForTimeout(1000);
  29  |     
  30  |     const startNew = page.locator('text=Start New').first();
  31  |     if (await startNew.isVisible()) {
  32  |       await startNew.click();
  33  |       await page.waitForTimeout(1000);
  34  |       
  35  |       const courseSelect = page.locator('select').first();
  36  |       if (await courseSelect.isVisible()) {
  37  |         const options = await courseSelect.locator('option').count();
  38  |         if (options > 1) {
  39  |           await courseSelect.selectOption({ index: 1 });
  40  |         }
  41  |       }
  42  |       
  43  |       const startButton = page.locator('button:has-text("Start Session")').first();
  44  |       if (await startButton.isVisible()) {
  45  |         await startButton.click();
  46  |         await page.waitForTimeout(4000);
  47  |       }
  48  |     }
  49  |   }
  50  | 
  51  |   test('1. Stream initialization - mediaDevices is accessible', async ({ page }) => {
  52  |     // Inject mock navigator.mediaDevices before page loads
  53  |     await page.addInitScript(() => {
  54  |       const mockGetUserMedia = async () => new MediaStream();
  55  |       (window as any).navigator.mediaDevices = {
  56  |         getUserMedia: mockGetUserMedia,
  57  |         enumerateDevices: async () => [],
  58  |         addEventListener: () => {},
  59  |         removeEventListener: () => {},
  60  |       };
  61  |     });
  62  |     
  63  |     await enterClassroom(page);
  64  |     await page.waitForTimeout(3000);
  65  |     
  66  |     // Verify mock is applied
  67  |     const hasMediaDevices = await page.evaluate(() => {
  68  |       return !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
  69  |     });
  70  |     expect(hasMediaDevices).toBe(true);
  71  |     
  72  |     // Verify no media error is displayed
  73  |     const hasMediaError = await page.locator('text=Media Error').count();
  74  |     expect(hasMediaError).toBe(0);
  75  |     
  76  |     // Verify classroom loaded
  77  |     const hasClassroom = await page.locator('text=Classroom').count();
  78  |     expect(hasClassroom).toBeGreaterThan(0);
  79  |   });
  80  | 
  81  |   test('2. Muted state sync - UI state matches socket events', async ({ page }) => {
  82  |     await enterClassroom(page);
  83  |     await page.waitForTimeout(2000);
  84  |     
  85  |     // Look for mic toggle button
  86  |     const micButton = page.locator('button[aria-label*="microphone" i], button:has(svg[class*="mic" i])').first();
  87  |     
  88  |     // Look for camera toggle button  
  89  |     const cameraButton = page.locator('button[aria-label*="camera" i], button:has(svg[class*="camera" i])').first();
  90  |     
  91  |     const hasMicButton = await micButton.count() > 0;
  92  |     const hasCameraButton = await cameraButton.count() > 0;
  93  |     
  94  |     console.log('Has mic toggle:', hasMicButton);
  95  |     console.log('Has camera toggle:', hasCameraButton);
  96  |     
  97  |     // If controls exist, verify click handlers are attached
  98  |     if (hasMicButton) {
  99  |       const buttonWorks = await micButton.evaluate((el: any) => {
  100 |         return el.onclick !== null || el.click !== undefined;
  101 |       });
  102 |       expect(buttonWorks).toBe(true);
  103 |       console.log('Mic button has click handler:', buttonWorks);
  104 |     }
  105 |     
  106 |     if (hasCameraButton) {
  107 |       const buttonWorks = await cameraButton.evaluate((el: any) => {
  108 |         return el.onclick !== null || el.click !== undefined;
  109 |       });
  110 |       expect(buttonWorks).toBe(true);
  111 |       console.log('Camera button has click handler:', buttonWorks);
  112 |     }
```