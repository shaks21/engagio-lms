/**
 * End-to-End Stress Test: Ghost Class Heatmap Verification
 *
 * RED Phase: Fails if the heatmap does not render exactly 10
 * participant cards with semantic color coding (Red/Yellow/Green).
 *
 * To run:
 *   1. npx tsx api/scripts/seed-engagement.ts   (seed ghost data)
 *   2. npx playwright test e2e/heatmap.spec.ts   (run this test)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://164.68.119.230:3001';

// Teacher credentials for the seeded tenant
const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS  = 'password123';

test.describe('Ghost Class Heatmap Stress Test', () => {
  test.beforeEach(async ({ page }) => {
    // ── Log in ──
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]',    TEACHER_EMAIL);
    await page.fill('input[name="password"]', TEACHER_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15_000 });

    // ── Navigate to Teacher Dashboard ──
    await page.goto(`${BASE_URL}/dashboard/teacher`);
    await page.waitForSelector('[data-testid="teacher-heatmap"]', { timeout: 15_000 });
  });

  test('renders 10 seeded participant cards with correct semantic colors', async ({ page }) => {
    // 1. Select the "Ghost Course" session from the dropdown
    const sessionBtn = page.locator('button:has-text("Choose Session")');
    if (await sessionBtn.isVisible().catch(() => false)) {
      await sessionBtn.click();
      // Our seeded course title contains "Ghost Course"
      await page.locator('text=Ghost Course').first().click();
    }

    // Wait for the grid to populate
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="participant-card-"]').length >= 10,
      null,
      { timeout: 15_000 }
    );

    // 2. Verify exactly 10 cards
    const cards = page.locator('[data-testid^="participant-card-"]').nth(1000);
    const count = await page.locator('[data-testid^="participant-card-"]').count();
    expect(count, `Expected 10 cards, got ${count}`).toBe(10);

    // 3. Verify semantic colors by score thresholds
    const scores = await page.$eval('[data-testid="teacher-heatmap"]', (el) => {
      return Array.from(el.querySelectorAll('[data-testid^="participant-card-"]'))
        .map((card) => ({
          score: Number(card.getAttribute('data-score')),
          className: (card as HTMLElement).className,
        }));
    });

    let red   = 0;
    let yellow = 0;
    let green = 0;

    for (const s of scores!) {
      expect(typeof s.score).toBe('number');
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);

      if (s.score < 40) {
        expect(s.className).toContain('bg-engagio-danger');
        red++;
      } else if (s.score <= 70) {
        expect(s.className).toContain('bg-engagio-warning');
        yellow++;
      } else {
        expect(s.className).toContain('bg-engagio-success');
        green++;
      }
    }

    // 4. Verify category counts match our seeded distribution
    expect(red).toBe(3);    // scores 20, 25, 38
    expect(yellow).toBe(3); // scores 45, 52, 60
    expect(green).toBe(4);  // scores 75, 82, 91, 95

    // 5. Summary stats should also reflect the counts
    const statLabels = page.locator('[class*="text-2xl"]');
    await expect(statLabels.first()).toBeVisible();

    // "Tracked" stat = 10
    const trackedText = page.locator('text=Tracked').locator('..').locator('div:first-child');
    await expect(trackedText).toHaveText('10');
  });
});
