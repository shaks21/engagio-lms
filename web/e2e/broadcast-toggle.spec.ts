/**
 * Broadcast Audio E2E — Teacher toggles broadcast → Students see indicator
 *
 * Verifies the fix:
 * - BreakoutTab broadcast button changes to green when active
 * - Student sidebar shows a "live-broadcast-indicator" when isBroadcasting=true
 * - Teacher toggles off → indicator disappears for students
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

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

async function loginBrowser(page: any, email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  const data = await registerOrLoginAPI(email, password, role);
  const token = data.accessToken as string;
  await page.goto(`${BASE}/login`);
  await page.evaluate((t: string) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  return token;
}

async function createCourseAndSession(teacherToken: string): Promise<string> {
  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ title: `Brd ${Date.now()}`, description: 'E2E' }),
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

test.setTimeout(120_000);

test('Broadcast Audio — teacher toggles broadcast, students see indicator', async ({ browser }) => {
  const ts = Date.now();
  const tEmail = `tbc-${ts}@test.io`;
  const sEmail = `sbc-${ts}@test.io`;
  const password = 'Password123!';

  /* 1. Auth */
  const tToken = await registerOrLoginAPI(tEmail, password, 'TEACHER').then(d => d.accessToken) as string;
  const sToken = await registerOrLoginAPI(sEmail, password, 'STUDENT').then(d => d.accessToken) as string;
  const sessionId = await createCourseAndSession(tToken);

  /* 2. Browser contexts */
  const tCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const sCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const tPage = await tCtx.newPage();
  const sPage = await sCtx.newPage();

  try {
    await Promise.all([
      loginBrowser(tPage, tEmail, password, 'TEACHER'),
      loginBrowser(sPage, sEmail, password, 'STUDENT'),
    ]);

    /* 3. Join classroom */
    await tPage.goto(`${BASE}/classroom/${sessionId}`);
    await sPage.goto(`${BASE}/classroom/${sessionId}`);
    await tPage.waitForTimeout(5000);
    await sPage.waitForTimeout(5000);

    const tJoin = tPage.getByRole('button', { name: /Join Classroom/i }).first();
    if (await tJoin.isVisible().catch(() => false)) await tJoin.click();
    const sJoin = sPage.getByRole('button', { name: /Join Classroom/i }).first();
    if (await sJoin.isVisible().catch(() => false)) await sJoin.click();
    await tPage.waitForTimeout(4000);
    await sPage.waitForTimeout(4000);

    /* 4. Open Breakout tab on teacher */
    const breakoutTab = tPage.locator('[data-testid="sidebar-tab-breakout"]').first();
    if (await breakoutTab.isVisible().catch(() => false)) {
      await breakoutTab.click();
      await tPage.waitForTimeout(500);
    }

    /* 4b. Open Breakout tab on student */
    const sBreakoutTab = sPage.locator('[data-testid="sidebar-tab-breakout"]').first();
    if (await sBreakoutTab.isVisible().catch(() => false)) {
      await sBreakoutTab.click();
      await sPage.waitForTimeout(500);
    }

    /* 5. Verify broadcast button exists in default state */
    const broadcastBtn = tPage.getByRole('button', { name: /Broadcast Audio/i }).first();
    await expect(broadcastBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ Teacher has Broadcast Audio button');

    /* 6. Before toggle: student should NOT see indicator */
    const studentIndicator = sPage.getByTestId('live-broadcast-indicator');
    await expect(studentIndicator).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Student does NOT see live-broadcast-indicator before toggle');

    /* 7. Teacher clicks broadcast ON */
    await broadcastBtn.click();
    await tPage.waitForTimeout(5500); // socket propagation + hook re-eval
    console.log('✅ Teacher clicked Broadcast ON');

    /* 8. Teacher button text changed to "Stop Broadcast" */
    const stopBtn = tPage.getByRole('button', { name: /Stop Broadcast/i }).first();
    await expect(stopBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ Teacher sees Stop Broadcast button');

    /* 9. Student sees live broadcast indicator */
    await expect(studentIndicator).toBeVisible({ timeout: 10000 });
    console.log('✅ Student sees live-broadcast-indicator');

    /* 10. Teacher toggles OFF */
    await stopBtn.click();
    await tPage.waitForTimeout(5500);
    console.log('✅ Teacher clicked Stop Broadcast');

    /* 11. Teacher button reverts to "Broadcast Audio" */
    const broadcastBtnRevert = tPage.getByRole('button', { name: /Broadcast Audio/i }).first();
    await expect(broadcastBtnRevert).toBeVisible({ timeout: 5000 });
    console.log('✅ Teacher sees Broadcast Audio button again after stop');

    /* 12. Student indicator disappears */
    await expect(studentIndicator).not.toBeVisible({ timeout: 10000 });
    console.log('✅ Student live-broadcast-indicator disappears after stop');

    console.log('\n🎉 Broadcast Audio E2E PASSED');
  } finally {
    await tCtx.close();
    await sCtx.close();
  }
});
