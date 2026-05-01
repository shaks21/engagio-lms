import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://164.68.119.230:3001';
const API  = process.env.E2E_API_URL || 'http://164.68.119.230:3000';

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

async function loginWithToken(page: any, token: string) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((t: string) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  // Ensure dashboard content is visible
  await page.waitForSelector('text=/Welcome back/', { timeout: 15000 });
}

test.setTimeout(120_000);

test('Teacher creates breakout rooms via modal: auto-shuffle, manual reassign, then close all', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `teach.${ts}@e2e.io`;
  const password = 'Password123!';
  const students: { email: string; page: any; ctx: any; token: string }[] = [];

  // ── Step 0: Register teacher + 6 students ──
  const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
  for (let i = 1; i <= 6; i++) {
    const sEmail = `stu${i}.${ts}@e2e.io`;
    const sData = await registerOrLoginAPI(sEmail, password, 'STUDENT');
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    await loginWithToken(page, sData.accessToken);
    students.push({ email: sEmail, page, ctx, token: sData.accessToken });
  }

  const tCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const tPage = await tCtx.newPage();
  await loginWithToken(tPage, tData.accessToken);

  try {
    // ── Step 1: Create course + session via API ──
    const courseRes = await (await fetch(`${API}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
      body: JSON.stringify({ title: `Breakout E2E ${ts}`, description: 'test' }),
    })).json();

    const sessionRes = await (await fetch(`${API}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
      body: JSON.stringify({ courseId: courseRes.id }),
    })).json();
    const sessionId = sessionRes.id;

    // ── Step 2: All join classroom ──
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

    // ── Step 3: Open breakout tab via rail ──
    const breakoutRailBtn = tPage.getByTestId('rail-btn-breakout').first();
    await expect(breakoutRailBtn).toBeVisible({ timeout: 8000 });
    await breakoutRailBtn.click();
    await tPage.waitForTimeout(500);

    // ── Step 4: Click "Create Rooms" to open modal ──
    const createRoomsBtn = tPage.getByTestId('create-rooms-btn').first();
    await expect(createRoomsBtn).toBeVisible();
    await expect(createRoomsBtn).toContainText('Create Rooms');
    await createRoomsBtn.click();
    await tPage.waitForTimeout(500);

    // ── Step 5: Modal opens — verify structure ──
    const modal = tPage.getByTestId('create-breakout-modal');
    await expect(modal).toBeVisible();
    await expect(tPage.getByText('Create Breakout Rooms')).toBeVisible();

    // Stepper should show default room count (2)
    const roomCountValue = tPage.getByTestId('room-count-value').first();
    await expect(roomCountValue).toBeVisible();
    const initialCount = parseInt(await roomCountValue.textContent() || '2', 10);
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // ── Step 6: Increment room count to 3 ──
    const plusBtn = tPage.getByTestId('room-count-plus').first();
    await expect(plusBtn).toBeVisible();
    await plusBtn.click(); // 3
    await tPage.waitForTimeout(200);
    const currentCount = parseInt(await roomCountValue.textContent() || '0', 10);
    expect(currentCount).toBe(3);

    // Allocation summary should reflect new count
    const summary = tPage.getByTestId('allocation-summary').first();
    await expect(summary).toBeVisible();
    const summaryText = await summary.textContent();
    expect(summaryText).toContain('3 room');

    // ── Step 7: Select "Assign Automatically" mode (default)
    const autoModeCard = tPage.getByTestId('mode-auto').first();
    await expect(autoModeCard).toBeVisible();

    // ── Step 8: Click Create button ──
    const createBtn = tPage.getByTestId('modal-create-btn').first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await tPage.waitForTimeout(2500);

    // Modal should close
    await expect(modal).not.toBeVisible();

    // ── Step 9: Verify breakout room cards appear in sidebar ──
    const roomCards = tPage.locator('[data-testid="breakout-room-card"]:visible');
    const cardCount = await roomCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2); // main + at least one breakout

    // At least one breakout room card should exist
    const breakoutCards = roomCards.filter({ hasText: /room-/i });
    const breakoutCardCount = await breakoutCards.count();
    expect(breakoutCardCount).toBeGreaterThanOrEqual(1);

    // Count total students shown across all room cards
    let totalAssigned = 0;
    const allStudentCounts = await tPage.locator('[data-testid="room-student-count"]').all();
    for (const sC of allStudentCounts) {
      const txt = await sC.textContent();
      const match = txt?.match(/(\d+)/);
      if (match) totalAssigned += parseInt(match[1], 10);
    }
    expect(totalAssigned).toBeGreaterThanOrEqual(6);

    // ── Step 10: Reopen modal via button ──
    const configBtn = tPage.getByTestId('create-rooms-btn').first();
    await expect(configBtn).toBeVisible();
    await configBtn.click();
    await tPage.waitForTimeout(500);
    await expect(modal).toBeVisible();

    // ── Step 11: Switch to Manual mode ──
    const manualModeCard = tPage.getByTestId('mode-manual').first();
    await expect(manualModeCard).toBeVisible();
    await manualModeCard.click();
    await tPage.waitForTimeout(500);

    // Unassigned pool should appear
    const unassignedPool = tPage.getByTestId('manual-unassigned-pool').first();
    await expect(unassignedPool).toBeVisible();

    // Room columns should exist
    const roomColumns = tPage.getByTestId('manual-room-column');
    expect(await roomColumns.count()).toBeGreaterThanOrEqual(1);

    // Move a student to a specific room column
    const assignBtns = await tPage.locator('[data-testid^="manual-assign-btn-"]').all();
    if (assignBtns.length > 0) {
      await assignBtns[0].click();
      await tPage.waitForTimeout(500);
    }

    // Create again
    const manualCreateBtn = tPage.getByTestId('modal-create-btn').first();
    await manualCreateBtn.click();
    await tPage.waitForTimeout(2500);
    await expect(modal).not.toBeVisible();

    // ── Step 12: Verify "Close All" button exists and works ──
    // Wait for button to appear (it may take a moment for state to propagate)
    await tPage.waitForTimeout(1500);
    const closeAllBtn = tPage.getByTestId('close-all-rooms-btn').first();
    await expect(closeAllBtn).toBeVisible();
    await closeAllBtn.click();
    await tPage.waitForTimeout(2000);

    // After closing, button text goes back to "Create Rooms"
    const afterCloseBtn = tPage.getByTestId('create-rooms-btn').first();
    await expect(afterCloseBtn).toContainText('Create Rooms');

    console.log('✅ Breakout modal E2E test passed');
  } finally {
    for (const s of students) { try { await s.ctx.close(); } catch (e) { /* ignore */ } }
    try { await tCtx.close(); } catch (e) { /* ignore */ } }
});
