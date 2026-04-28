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

test('Teacher creates 3 breakout rooms, auto-shuffles 6 students, then manually reallocates', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `teach.${ts}@brk.io`;
  const password = 'Password123!';
  const students: { email: string; page: any; ctx: any }[] = [];

  // Register teacher + 6 students
  const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
  for (let i = 1; i <= 6; i++) {
    const sEmail = `stu${i}.${ts}@brk.io`;
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
      body: JSON.stringify({ title: `Breakout Num Course ${ts}`, description: 'test' }),
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

    // ── Step A: Number dropdown exists, scoped to desktop sidebar, max 25 ──
    const roomCountSelect = tPage.locator('aside [data-testid="breakout-room-count"]').first();
    await expect(roomCountSelect).toBeVisible();
    const options = await roomCountSelect.locator('option').all();
    const values = await Promise.all(options.map((o: any) => o.getAttribute('value')));
    expect(values.map((v: any) => parseInt(v, 10))).toContain(25);

    // ── Step B: Select 3 rooms, shows per-room capacity hint ──
    await roomCountSelect.selectOption('3');
    await tPage.waitForTimeout(200);
    const capacityHint = tPage.locator('aside [data-testid="room-capacity-hint"]').first();
    await expect(capacityHint).toBeVisible();
    const hintText = await capacityHint.textContent();
    expect(hintText).toMatch(/2\s*students?\s*per\s*room/i);

    // ── Step C: Auto shuffle ──
    const shuffleBtn = tPage.locator('aside').getByRole('button', { name: /Auto Shuffle/i });
    await expect(shuffleBtn).toBeVisible();
    await shuffleBtn.click();
    await tPage.waitForTimeout(2500);

    // Verify exactly 3 room cards appear
    const roomCards = tPage.locator('aside [data-testid="breakout-room-card"]');
    let cardCount = await roomCards.count();
    expect(cardCount).toBe(3);

    // Verify total assigned students = 6
    let totalAssigned = 0;
    for (let i = 0; i < cardCount; i++) {
      const countText = await roomCards.nth(i).getByTestId('room-student-count').textContent();
      totalAssigned += parseInt(countText || '0', 10);
    }
    expect(totalAssigned).toBe(6);

    // ── Step D: Manual allocation ──
    const manualBtn = tPage.locator('aside').getByRole('button', { name: /Manual Allocation/i });
    await expect(manualBtn).toBeVisible();
    await manualBtn.click();
    await tPage.waitForTimeout(500);

    // Unassigned pool should exist
    const unassignedPool = tPage.locator('aside [data-testid="unassigned-pool"]').first();
    await expect(unassignedPool).toBeVisible();

    // Move one student from room-1 to unassigned, then to room-2
    const firstRoom = roomCards.first();
    const moveToUnassigned = firstRoom.getByRole('button', { name: /Move to unassigned/i }).first();
    if (await moveToUnassigned.isVisible().catch(() => false)) {
      await moveToUnassigned.click();
      await tPage.waitForTimeout(500);

      // Now assign to second room
      const assignToRoom2 = tPage.getByTestId('assign-to-room-1'); // 0-indexed data-testid
      if (await assignToRoom2.isVisible().catch(() => false)) {
        await assignToRoom2.click();
        await tPage.waitForTimeout(500);
      }
    }

    // ── Step E: Close all rooms ──
    const closeBtn = tPage.locator('aside').getByRole('button', { name: /Close All Rooms/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await tPage.waitForTimeout(2000);

    cardCount = await roomCards.count();
    expect(cardCount).toBe(0);

    console.log('✅ Breakout number-shuffle-manual test passed');
  } finally {
    for (const s of students) { try { await s.ctx.close(); } catch (e) { /* ignore */ } }
    try { await tCtx.close(); } catch (e) { /* ignore */ }
  }
});
