/**
 * RED Phase: Class Pulse Line Chart E2E
 *
 * The test must fail until the ClassPulseChart component is implemented.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://164.68.119.230:3001';

const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS  = 'password123';

test.describe('Class Pulse Chart (TDD)', () => {
  test('renders recharts area chart with Live indicator', async ({ page }) => {
    // 1. Log in as teacher
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input#email',    TEACHER_EMAIL);
    await page.fill('input#password', TEACHER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 15_000 });

    // 2. Navigate to Teacher Dashboard
    await page.goto(`${BASE_URL}/dashboard/teacher`);

    // 3. Select the first active session from the dropdown
    const sessionPicker = page.locator('[data-testid="session-picker"]');
    if (await sessionPicker.isVisible().catch(() => false)) {
      const pickerText = await sessionPicker.textContent();
      if (pickerText?.includes('Choose Session') || pickerText?.includes('No Active Sessions')) {
        await sessionPicker.click();
        // Click first dropdown option
        const firstOpt = page.locator('.absolute.right-0 button[class*="w-full"]').first();
        await firstOpt.click();
        console.log('Selected first session');
      }
    }
    // Wait for API call + chart to render
    await page.waitForTimeout(3000);

    // ── Assertions ──

    // 4. Expect an <svg> with class recharts-surface to exist
    const chartSurface = page.locator('svg[class*="recharts"]');
    await expect(chartSurface, 'recharts surface not found').toBeVisible({ timeout: 15_000 });

    // 5. Expect a "Live" status indicator (pulsing green dot)
    const liveIndicator = page.locator('[data-testid="pulse-live-indicator"]');
    await expect(liveIndicator, 'Live pulse indicator not found').toBeVisible({ timeout: 10_000 });
    // The green pulse dot is on an inner span
    await expect(liveIndicator.locator('span[class*="bg-engagio-success"]').first()).toBeVisible();
    await expect(liveIndicator.locator('span[class*="animate-ping"]').first()).toBeVisible();

    // 6. Expect chart title "Class Pulse"
    await expect(page.locator('text=Class Pulse')).toBeVisible();
  });
});
