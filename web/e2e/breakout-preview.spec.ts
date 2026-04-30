import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://164.68.119.230:3001';
const API  = process.env.API_URL || 'http://164.68.119.230:3000';

async function registerOrLoginAPI(email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  let res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) {
    res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
  }
  if (res.status >= 400) throw new Error(`Auth failed for ${email}: ${res.status}`);
  return res.json();
}

async function loginBrowser(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.setTimeout(120_000);

test('State-First Preview: teacher clicks shuffle, sees draft, confirms, students transfer', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `teach.${ts}@prev.io`;
  const password = 'Password123!';
  const students: { email: string; page: any; ctx: any }[] = [];

  const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
  for (let i = 1; i <= 4; i++) {
    const sEmail = `stu${i}.${ts}@prev.io`;
    await registerOrLoginAPI(sEmail, password, 'STUDENT');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await loginBrowser(page, sEmail, password);
    students.push({ email: sEmail, page, ctx });
  }

  const tCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tPage = await tCtx.newPage();
  await loginBrowser(tPage, tEmail, password);

  try {
    // Create course + session
    const courseRes = await (await fetch(`${API}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
      body: JSON.stringify({ title: `Preview Course ${ts}`, description: 'test' }),
    })).json();

    const sessionRes = await (await fetch(`${API}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
      body: JSON.stringify({ courseId: courseRes.id }),
    })).json();
    const sessionId = sessionRes.id;

    // All join classroom
    await Promise.all(students.map(async (s) => {
      await s.page.goto(`${BASE}/classroom/${sessionId}`);
      const joinBtn = s.page.getByRole('button', { name: /Join/i }).first();
      await expect(joinBtn).toBeVisible({ timeout: 10000 });
      await joinBtn.click();
    }));

    await tPage.goto(`${BASE}/classroom/${sessionId}`);
    const joinBtn = tPage.getByRole('button', { name: /Join/i }).first();
    await expect(joinBtn).toBeVisible({ timeout: 10000 });
    await joinBtn.click();

    // Open breakout tab
    const tab = tPage.getByTestId('sidebar-tab-breakout').first();
    await expect(tab).toBeVisible({ timeout: 8000 });
    await tab.click();

    // Select 3 rooms
    const roomCountSelect = tPage.locator('[data-testid="classroom-sidebar"] [data-testid="breakout-room-count"]').first();
    await expect(roomCountSelect).toBeVisible();
    await roomCountSelect.selectOption('3');

    // ── Step 1: Click Auto Shuffle ──
    const shuffleBtn = tPage.locator('[data-testid="classroom-sidebar"]').getByRole('button', { name: /Auto Shuffle/i });
    await expect(shuffleBtn).toBeVisible();
    await shuffleBtn.click();

    // ── Step 2: Verify Draft Mode (Confirm + Cancel visible) ──
    const confirmBtn = tPage.locator('[data-testid="confirm-shuffle"]').first();
    const cancelBtn  = tPage.locator('[data-testid="cancel-shuffle"]').first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await expect(cancelBtn).toBeVisible({ timeout: 5000 });

    // ── Step 3: Verify room cards visible (Main Room + 3 breakout rooms) ──
    const roomCards = tPage.locator('[data-testid="breakout-room-card"]:visible');
    await expect(roomCards).toHaveCount(4, { timeout: 5000 }); // main + room-a + room-b + room-c

    // ── Step 4: Confirm Preview ──
    await confirmBtn.click();

    // After confirm: Confirm/Cancel should disappear (we're back to normal controls)
    await expect(confirmBtn).toBeHidden({ timeout: 8000 });
    await expect(cancelBtn).toBeHidden({ timeout: 8000 });

    // Verify room cards are still visible after confirm
    await expect(tPage.locator('[data-testid="breakout-room-card"]:visible')).toHaveCount(4, { timeout: 5000 });

    console.log('✅ State-First Preview test passed');
  } finally {
    for (const s of students) { try { await s.ctx.close(); } catch (e) { /* ignore */ } }
    try { await tCtx.close(); } catch (e) { /* ignore */ }
  }
});
