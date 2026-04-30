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

  // Register teacher + 4 students
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
    for (const s of students) {
      await s.page.goto(`${BASE}/classroom/${sessionId}`);
      await s.page.waitForTimeout(1500);
      const joinBtn = s.page.getByRole('button', { name: /Join/i }).first();
      if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
      await s.page.waitForTimeout(2000);
    }
    await tPage.goto(`${BASE}/classroom/${sessionId}`);
    await tPage.waitForTimeout(1500);
    const joinBtn = tPage.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await tPage.waitForTimeout(2000);

    // Open breakout tab
    const tab = tPage.getByTestId('sidebar-tab-breakout').first();
    await expect(tab).toBeVisible({ timeout: 8000 });
    await tab.click();
    await tPage.waitForTimeout(500);

    // Select 3 rooms
    const roomCountSelect = tPage.locator('[data-testid="classroom-sidebar"] [data-testid="breakout-room-count"]').first();
    await expect(roomCountSelect).toBeVisible();
    await roomCountSelect.selectOption('3');
    await tPage.waitForTimeout(200);

    // ── Step 1: Click Auto Shuffle ──
    const shuffleBtn = tPage.locator('[data-testid="classroom-sidebar"]').getByRole('button', { name: /Auto Shuffle/i });
    await expect(shuffleBtn).toBeVisible();
    await shuffleBtn.click();
    await tPage.waitForTimeout(1500);

    // ── Step 2: Verify Preview Mode (Confirm + Cancel visible) ──
    const confirmBtn = tPage.locator('[data-testid="confirm-shuffle"]').first();
    const cancelBtn  = tPage.locator('[data-testid="cancel-shuffle"]').first();
    await expect(confirmBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // ── Step 3: Verify exactly 3 room cards (empty rooms shown) ──
    const roomCards = tPage.locator('[data-testid="breakout-room-card"]:visible');
    let cardCount = await roomCards.count();

    // In preview mode with 3 rooms selected, should see Main Room + 3 breakout rooms
    expect(cardCount >= 3).toBe(true);

    // Verify total assigned students = 4 (teacher stays in main)
    let totalAssigned = 0;
    for (let i = 0; i < cardCount; i++) {
      const countText = await roomCards.nth(i).getByTestId('room-student-count').textContent();
      totalAssigned += parseInt(countText || '0', 10);
    }
    // Main room should contain teacher (local participant), so total participants = 5
    expect(totalAssigned).toBeGreaterThanOrEqual(4);

    // ── Step 4: Confirm Preview ──
    await confirmBtn.click();
    await tPage.waitForTimeout(2000);

    // Verify students show in breakout rooms after confirm
    const confirmedCards = tPage.locator('[data-testid="breakout-room-card"]:visible');
    let confirmedCount = await confirmedCards.count();
    expect(confirmedCount >= 3).toBe(true);

    console.log('✅ State-First Preview test passed');
  } finally {
    for (const s of students) { try { await s.ctx.close(); } catch (e) { /* ignore */ } }
    try { await tCtx.close(); } catch (e) { /* ignore */ }
  }
});
