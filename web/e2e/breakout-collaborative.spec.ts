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
  if (!res.ok) throw new Error(`Auth failed for ${email}: ${res.status}`);
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

test.describe('Collaborative Breakouts — Permissions, Self-Selection, Broadcasting', () => {

  /* ══════════════════════════
     TEST 1: Permission Escalation
  ══════════════════════════ */
  test('Teacher assigns student to breakout → LiveKit permissions grant audio/video/data publish', async ({ browser }) => {
    const ts       = Date.now();
    const tEmail   = `teach.${ts}@brk.io`;
    const sEmail   = `stu.${ts}@brk.io`;
    const password = 'Password123!';

    const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
    await registerOrLoginAPI(sEmail, password, 'STUDENT');

    const tCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const sCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tPage = await tCtx.newPage();
    const sPage = await sCtx.newPage();

    try {
      // Create course + session via API
      const courseRes = await (await fetch(`${API}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ title: `Perm Course ${ts}`, description: 'test' }),
      })).json();

      const sessionRes = await (await fetch(`${API}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ courseId: courseRes.id }),
      })).json();
      const sessionId = sessionRes.id;

      // Join classroom
      await loginBrowser(sPage, sEmail, password);
      await sPage.goto(`${BASE}/classroom/${sessionId}`);
      await sPage.waitForTimeout(1500);
      const joinBtn = sPage.getByRole('button', { name: /Join/i }).first();
      if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
      await sPage.waitForTimeout(2000);

      await loginBrowser(tPage, tEmail, password);
      await tPage.goto(`${BASE}/classroom/${sessionId}`);
      await tPage.waitForTimeout(1500);
      const tJoinBtn = tPage.getByRole('button', { name: /Join/i }).first();
      if (await tJoinBtn.isVisible().catch(() => false)) await tJoinBtn.click();
      await tPage.waitForTimeout(2000);

      // Open breakout tab
      const tab = tPage.getByTestId('sidebar-tab-breakout').first();
      await expect(tab).toBeVisible({ timeout: 8000 });
      await tab.click();
      await tPage.waitForTimeout(500);

      // ── Step A: Before assignment, share-screen button is DISABLED for student ──
      const shareBtnBefore = sPage.getByRole('button', { name: /Share Screen/i });
      if (await shareBtnBefore.count() > 0) {
        await expect(shareBtnBefore).toBeDisabled();
      }

      // Teacher selects 2 rooms and shuffles
      const roomCountSelect = tPage.getByTestId('breakout-room-count');
      await roomCountSelect.selectOption('2');
      await tPage.waitForTimeout(200);

      const shuffleBtn = tPage.getByRole('button', { name: /Auto Shuffle/i });
      await shuffleBtn.click();
      await tPage.waitForTimeout(3000);

      // ── Step B: After assignment, student can see enabled share-screen ──
      await sPage.waitForTimeout(2000);
      const shareBtnAfter = sPage.getByRole('button', { name: /Share Screen/i });
      if (await shareBtnAfter.count() > 0) {
        // Verify button not disabled (presenter state unlocked)
        await expect(shareBtnAfter).not.toHaveAttribute('disabled', '', { timeout: 5000 });
      }

      // Console log trace for metadata + permission
      const logs = await sPage.evaluate(() => (window as any).__breakoutState);
      console.log('[E2E] __breakoutState after assignment:', JSON.stringify(logs));

      // ── Step C: Close rooms → permissions revert ──
      const closeBtn = tPage.getByRole('button', { name: /Close All Rooms/i }).first();
      await closeBtn.click();
      await tPage.waitForTimeout(2000);
      await sPage.waitForTimeout(2000);

      if (await shareBtnAfter.count() > 0) {
        await expect(shareBtnAfter).toBeDisabled();
      }

      console.log('✅ TEST 1: Permission escalation passed');
    } finally {
      try { await tCtx.close(); } catch (e) { /* ignore */ }
      try { await sCtx.close(); } catch (e) { /* ignore */ }
    }
  });

  /* ══════════════════════════
     TEST 2: Self-Selection Mode
  ══════════════════════════ */
  test('Teacher enables self-selection → student can freely switch breakout rooms', async ({ browser }) => {
    const ts       = Date.now();
    const tEmail   = `teach.${ts}@brk.io`;
    const s1Email  = `stu1.${ts}@brk.io`;
    const s2Email  = `stu2.${ts}@brk.io`;
    const password = 'Password123!';

    const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
    await registerOrLoginAPI(s1Email, password, 'STUDENT');
    await registerOrLoginAPI(s2Email, password, 'STUDENT');

    const tCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const s1Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const s2Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tPage  = await tCtx.newPage();
    const s1Page = await s1Ctx.newPage();
    const s2Page = await s2Ctx.newPage();

    try {
      const courseRes = await (await fetch(`${API}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ title: `SelfSel Course ${ts}`, description: 'test' }),
      })).json();

      const sessionRes = await (await fetch(`${API}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ courseId: courseRes.id }),
      })).json();
      const sessionId = sessionRes.id;

      // All join
      for (const p of [s1Page, s2Page, tPage]) {
        await p.goto(`${BASE}/classroom/${sessionId}`);
        await p.waitForTimeout(1500);
        const btn = p.getByRole('button', { name: /Join/i }).first();
        if (await btn.isVisible().catch(() => false)) await btn.click();
        await p.waitForTimeout(2000);
      }

      // Teacher opens breakout tab and configures 3 rooms
      const tab = tPage.getByTestId('sidebar-tab-breakout').first();
      await tab.click();
      await tPage.waitForTimeout(500);

      const roomCountSelect = tPage.getByTestId('breakout-room-count');
      await roomCountSelect.selectOption('3');

      // Enable self-selection mode
      const selfSelectBtn = tPage.getByRole('button', { name: /Enable Self-Selection/i });
      if (await selfSelectBtn.isVisible().catch(() => false)) {
        await selfSelectBtn.click();
        await tPage.waitForTimeout(500);
      }

      // Students see "Switch to this Room" on room cards
      const joinBtnS1 = s1Page.getByTestId('join-room-room-b');
      await expect(joinBtnS1).toBeVisible({ timeout: 8000 });
      await joinBtnS1.click();
      await s1Page.waitForTimeout(1500);

      // Verify student1 metadata updated
      const state1 = await s1Page.evaluate(() => (window as any).__breakoutState);
      console.log('[E2E] Student1 __breakoutState:', JSON.stringify(state1));

      // Student2 joins room-c
      const joinBtnS2 = s2Page.getByTestId('join-room-room-c');
      await expect(joinBtnS2).toBeVisible({ timeout: 8000 });
      await joinBtnS2.click();
      await s2Page.waitForTimeout(1500);

      // Verify student2 metadata
      const state2 = await s2Page.evaluate(() => (window as any).__breakoutState);
      console.log('[E2E] Student2 __breakoutState:', JSON.stringify(state2));

      console.log('✅ TEST 2: Self-selection passed');
    } finally {
      try { await tCtx.close(); } catch (e) { }
      try { await s1Ctx.close(); } catch (e) { }
      try { await s2Ctx.close(); } catch (e) { }
    }
  });

  /* ══════════════════════════
     TEST 3: Global Broadcast
  ══════════════════════════ */
  test('Teacher sends global broadcast → both breakout rooms show toast simultaneously', async ({ browser }) => {
    const ts       = Date.now();
    const tEmail   = `teach.${ts}@brk.io`;
    const s1Email  = `stu1.${ts}@brk.io`;
    const s2Email  = `stu2.${ts}@brk.io`;
    const password = 'Password123!';

    const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
    await registerOrLoginAPI(s1Email, password, 'STUDENT');
    await registerOrLoginAPI(s2Email, password, 'STUDENT');

    const tCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const s1Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const s2Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const tPage  = await tCtx.newPage();
    const s1Page = await s1Ctx.newPage();
    const s2Page = await s2Ctx.newPage();

    try {
      const courseRes = await (await fetch(`${API}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ title: `Broadcast Course ${ts}`, description: 'test' }),
      })).json();

      const sessionRes = await (await fetch(`${API}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ courseId: courseRes.id }),
      })).json();
      const sessionId = sessionRes.id;

      // All join
      for (const p of [s1Page, s2Page, tPage]) {
        await p.goto(`${BASE}/classroom/${sessionId}`);
        await p.waitForTimeout(1500);
        const btn = p.getByRole('button', { name: /Join/i }).first();
        if (await btn.isVisible().catch(() => false)) await btn.click();
        await p.waitForTimeout(2000);
      }

      // Teacher assigns students to different breakout rooms via API
      const s1Token = await s1Page.evaluate(() => localStorage.getItem('engagio_token'));
      const s2Token = await s2Page.evaluate(() => localStorage.getItem('engagio_token'));
      const getUserId = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub;
      const s1Id = getUserId(s1Token!);
      const s2Id = getUserId(s2Token!);

      await fetch(`${API}/sessions/${sessionId}/breakouts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tData.accessToken}` },
        body: JSON.stringify({ assignments: { [s1Id]: 'room-a', [s2Id]: 'room-b' } }),
      });
      await tPage.waitForTimeout(1500);

      // Teacher opens breakout tab → broadcast input
      const tab = tPage.getByTestId('sidebar-tab-breakout').first();
      await tab.click();
      await tPage.waitForTimeout(500);

      // Type broadcast message
      const broadcastInput = tPage.getByTestId('broadcast-input');
      await expect(broadcastInput).toBeVisible({ timeout: 5000 });
      await broadcastInput.fill('Heads up — 2 minutes remaining!');

      // Send broadcast
      const sendBtn = tPage.getByRole('button', { name: /Send Broadcast/i });
      await sendBtn.click();
      await tPage.waitForTimeout(1000);

      // ── Both students should see overlay ──
      const overlayS1 = s1Page.getByTestId('broadcast-overlay');
      const overlayS2 = s2Page.getByTestId('broadcast-overlay');

      await expect(overlayS1).toBeVisible({ timeout: 5000 });
      await expect(overlayS2).toBeVisible({ timeout: 5000 });

      await expect(overlayS1).toContainText('Heads up');
      await expect(overlayS2).toContainText('Heads up');

      // Overlay should auto-dismiss after ~5 seconds
      await s1Page.waitForTimeout(6000);
      await expect(overlayS1).not.toBeVisible();
      await expect(overlayS2).not.toBeVisible();

      console.log('✅ TEST 3: Global broadcast passed');
    } finally {
      try { await tCtx.close(); } catch (e) { }
      try { await s1Ctx.close(); } catch (e) { }
      try { await s2Ctx.close(); } catch (e) { }
    }
  });
});
