/**
 * RED — Regression test for chat persistence bug.
 * Chat messages must survive sidebar tab changes.
 *
 * Run: npx playwright test e2e/chat-persistence.spec.ts --reporter=line
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://164.68.119.230:3001';
const TEST_EMAIL = 'e2e_playwright@test.com';
const TEST_PASSWORD='TestPass123!';

async function loginAsTeacher(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|classroom/, { timeout: 20000 });
}

async function ensureUser(page: Page) {
  try {
    await loginAsTeacher(page);
  } catch {
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.selectOption('select', 'TEACHER');
    await page.click('button:has-text("Create Account")');
    await page.waitForTimeout(3000);
    await loginAsTeacher(page);
  }
}

async function goToClassroom(page: Page) {
  await page.goto(`${BASE_URL}/classroom/test-persist-${Date.now()}`);
  await expect(page.locator('text=Ready to join?').first()).toBeVisible({ timeout: 20000 });
}

test.describe('Chat Persistence — RED', () => {
  test.beforeEach(async ({ page }) => {
    await ensureUser(page);
    await goToClassroom(page);
  });

  test('messages persist across sidebar tab switches', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.click('button:has-text("Join Classroom")');
    await page.waitForTimeout(3000);

    // Ensure Chat tab
    const chatTab = page.locator('button[aria-label="Chat"]').first();
    await chatTab.click({ force: true });
    await page.waitForTimeout(300);

    // Send unique message
    const msg = `Persistent-msg-${Date.now()}`;
    const input = page.locator('input[placeholder*="message"]').first();
    await input.fill(msg);
    await input.press('Enter');
    await page.waitForTimeout(600);

    // Verify message visible
    await expect(page.locator(`text=${msg}`).first()).toBeVisible();

    // Switch to People tab — Chat unmounts
    await page.locator('button[aria-label="People"]').first().click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('text=(You)').first()).toBeVisible();

    // Switch BACK to Chat — Chat re-mounts
    await chatTab.click({ force: true });
    await page.waitForTimeout(500);

    // FAILS before fix: messages state resets to [] on re-mount
    await expect(page.locator(`text=${msg}`).first()).toBeVisible();
  });
});
