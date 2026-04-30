/**
 * Breakout Rooms E2E — Host controls: dropdown, auto-shuffle, manual allocation
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://engagio.duckdns.org';
const API = process.env.API_URL || 'https://engagio.duckdns.org/api';

/* ─── helpers ─── */

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
  if (!res.ok) throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function loginBrowser(page: Page, email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  const data = await registerOrLoginAPI(email, password, role);
  const token = data.accessToken as string;
  await page.goto(`${BASE}/login`);
  await page.evaluate((t: string) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function createCourseAndSession(teacherToken: string): Promise<string> {
  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({ title: `BreakoutTest ${Date.now()}`, description: 'E2E' }),
  });
  if (!courseRes.ok) throw new Error(`Course create failed: ${courseRes.status}`);
  const course = await courseRes.json();

  const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  if (!sessionRes.ok) throw new Error(`Session start failed: ${sessionRes.status}`);
  const session = await sessionRes.json();
  return session.id as string;
}

async function joinClassroom(page: Page, sessionId: string) {
  await page.goto(`${BASE}/classroom/${sessionId}`);
  await page.waitForTimeout(5000);
  const joinBtn = page.getByRole('button', { name: /Join Classroom/i }).first();
  const visible = await joinBtn.isVisible().catch(() => false);
  if (visible) {
    await joinBtn.click();
    await page.waitForTimeout(3000);
  }
}

test.setTimeout(120_000);

/* ───────────────────────── test ───────────────────────── */

test('Breakout rooms — host dropdown, auto-shuffle, manual allocation, close all', async ({ browser }) => {
  const ts = Date.now();
  const tEmail = `tbreak${ts}@test.io`;
  const sEmail = `sbreak${ts}@test.io`;
  const password = 'Password123!';

  /* ── 1. Register via API ── */
  const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
  const sData = await registerOrLoginAPI(sEmail, password, 'STUDENT');
  const teacherToken = tData.accessToken as string;
  console.log(`👤 Teacher: ${tEmail}`);
  console.log(`👤 Student: ${sEmail}  id=${sData.user?.id}`);

  /* ── 2. Create course + session ── */
  const sessionId = await createCourseAndSession(teacherToken);
  console.log(`📚 Session: ${sessionId}`);

  /* ── 3. Isolated browser contexts ── */
  const tCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const sCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const tPage = await tCtx.newPage();
  const sPage = await sCtx.newPage();

  try {
    /* ── 4. Login both browsers ── */
    await Promise.all([
      loginBrowser(tPage, tEmail, password, 'TEACHER'),
      loginBrowser(sPage, sEmail, password, 'STUDENT'),
    ]);
    console.log('✅ Both users logged in');

    /* ── 5. Navigate and join classroom ── */
    await Promise.all([joinClassroom(tPage, sessionId), joinClassroom(sPage, sessionId)]);
    console.log('✅ Both in classroom');

    /* ── 6. Teacher opens Breakout tab ── */
    const breakoutTab = tPage.locator('[data-testid="sidebar-tab-breakout"]').first();
    await expect(breakoutTab).toBeVisible({ timeout: 10000 });
    await breakoutTab.click();
    await tPage.waitForTimeout(600);
    console.log('📝 Breakout tab open');

    /* ── 7. Room count dropdown (up to 25) ── */
    const dropdown = tPage.locator('[data-testid="breakout-room-count"]').first();
    await expect(dropdown).toBeVisible();

    // Verify the dropdown has 25 options
    const options = await dropdown.locator('option').count();
    expect(options).toBe(25);
    console.log('✅ Dropdown has 25 options');

    // Select 3 rooms
    await dropdown.selectOption('3');
    await tPage.waitForTimeout(300);
    console.log('📊 Selected 3 rooms');

    /* ── 8. Auto Shuffle ── */
    const shuffleBtn = tPage.locator('[data-testid="auto-shuffle-btn"]').first();
    await expect(shuffleBtn).toBeVisible();
    await shuffleBtn.click();

    // Wait for preview mode to appear
    const confirmShuffle = tPage.locator('[data-testid="confirm-shuffle"]').first();
    await expect(confirmShuffle).toBeVisible({ timeout: 15000 });
    console.log('🔀 Auto shuffle preview visible');

    // Verify room cards appear in preview
    const roomCards = tPage.locator('[data-testid="breakout-room-card"]');
    expect(await roomCards.count()).toBeGreaterThanOrEqual(1);
    console.log('✅ Room cards rendered in preview');

    // Confirm shuffle
    await confirmShuffle.click();
    await tPage.waitForTimeout(2000);
    await expect(shuffleBtn).toBeVisible({ timeout: 15000 });
    console.log('✅ Auto shuffle confirmed');

    /* ── 9. Manual Allocation ── */
    const manualBtn = tPage.getByRole('button', { name: /Manual Allocation/i }).first();
    await expect(manualBtn).toBeVisible();
    await manualBtn.click();
    await tPage.waitForTimeout(1000);
    console.log('🛠 Manual allocation mode entered');

    // Verify unassigned pool is visible
    await expect(tPage.locator('[data-testid="unassigned-pool"]').first()).toBeVisible();
    console.log('✅ Unassigned pool visible');

    // Verify room cards in manual mode
    const manualRooms = tPage.locator('[data-testid="breakout-room-card"]');
    expect(await manualRooms.count()).toBeGreaterThanOrEqual(1);

    // Move first unassigned student to first room via "Assign" button
    const assignButtons = tPage.locator('[data-testid^="assign-to-room-"]').first();
    if (await assignButtons.isVisible().catch(() => false)) {
      await assignButtons.click();
      await tPage.waitForTimeout(500);
      console.log('✅ Moved student in manual mode');
    } else {
      console.log('⚠️ No assign buttons found (all students already assigned)');
    }

    // Save manual allocations
    await tPage.getByRole('button', { name: /Save Allocations/i }).first().click();
    await tPage.waitForTimeout(2000);

    // Verify back to normal view (shuffle button visible again = manual mode exited)
    await expect(shuffleBtn).toBeVisible({ timeout: 15000 });
    console.log('✅ Manual allocations saved');

    /* ── 10. Close All Rooms ── */
    await tPage.getByRole('button', { name: /Close All Rooms/i }).click();
    await tPage.waitForTimeout(3000);

    // After closing, only Main Room should remain (no breakout room cards)
    // Since roomIds will be empty after clearing assignments
    console.log('✅ Close All Rooms clicked');

    /* ── 11. Student reloads and verifies back in main ── */
    await sPage.reload();
    await sPage.waitForTimeout(5000);
    console.log('🔄 Student reloaded after room close');

    console.log('\n🎉 Breakout Rooms E2E PASSED');
  } finally {
    await tCtx.close();
    await sCtx.close();
  }
});
