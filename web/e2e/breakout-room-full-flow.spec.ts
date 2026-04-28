import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://164.68.119.230:3001';
const API  = process.env.API_URL || 'http://164.68.119.230:3000';
const SCREENSHOT_DIR = '/tmp/breakout-e2e';

let shotIdx = 0;
async function snap(page: any, label: string) {
  const path = `${SCREENSHOT_DIR}/${String(++shotIdx).padStart(2, '0')}_${label}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`📸 ${label} → ${path}`);
}

async function registerOrLoginAPI(email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  // Try login first
  let res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) {
    // Register
    const reg = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (reg.status >= 400) {
      const body = await reg.text();
      throw new Error(`Register ${email} failed: ${reg.status} ${body}`);
    }
    res = reg;
  } else if (res.status >= 400) {
    const body = await res.text();
    throw new Error(`Login ${email} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function loginBrowser(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.setTimeout(90_000);

test('Breakout Room Full E2E Flow', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `teach.${ts}@brk.io`;
  const s1Email  = `stu1.${ts}@brk.io`;
  const s2Email  = `stu2.${ts}@brk.io`;
  const password = 'Password123!';

  const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
  await registerOrLoginAPI(s1Email, password, 'STUDENT');
  await registerOrLoginAPI(s2Email, password, 'STUDENT');

  const tToken = tData.accessToken;
  console.log(`👤 Teacher: ${tEmail}, token: ${tToken?.slice(0,20)}...`);

  const tCtx   = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const s1Ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const s2Ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tPage  = await tCtx.newPage();
  const s1Page = await s1Ctx.newPage();
  const s2Page = await s2Ctx.newPage();

  try {
    // ── Step 1: Login ──
    await Promise.all([
      loginBrowser(tPage, tEmail, password),
      loginBrowser(s1Page, s1Email, password),
      loginBrowser(s2Page, s2Email, password),
    ]);
    console.log('✅ All logged in');
    await snap(tPage, '01_teacher_dashboard');

    // ── Step 2: Create course + session ──
    const courseRes = await (await fetch(`${API}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
      body: JSON.stringify({ title: `Breakout Course ${ts}`, description: 'test' }),
    })).json();
    console.log('📚 Course:', courseRes.id || 'ERROR', JSON.stringify(courseRes).slice(0,200));

    const sessionRes = await (await fetch(`${API}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
      body: JSON.stringify({ courseId: courseRes.id }),
    })).json();
    console.log('🏫 Session:', sessionRes.id || 'ERROR', JSON.stringify(sessionRes).slice(0,200));
    if (!sessionRes.id) throw new Error('Session creation failed');
    const sessionId = sessionRes.id;

    // ── Step 3: Join classroom ──
    for (const p of [tPage, s1Page, s2Page]) {
      await p.goto(`${BASE}/classroom/${sessionId}`);
      await p.waitForTimeout(1500);
      const joinBtn = p.getByRole('button', { name: /Join/i }).first();
      if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
      await p.waitForTimeout(2000);
    }
    await snap(tPage, '02_teacher_classroom');

    // ── Step 4: Breakout tab ──
    const tab = tPage.getByTestId('sidebar-tab-breakout').first();
    await expect(tab).toBeVisible({ timeout: 8000 });
    await tab.click();
    await tPage.waitForTimeout(500);
    await snap(tPage, '03_teacher_breakout_tab');

    // ── Step 5: Shuffle ──
    const shuffleBtn = tPage.getByRole('button', { name: /Shuffle into Rooms/i });
    await expect(shuffleBtn).toBeVisible({ timeout: 8000 });
    await shuffleBtn.click();
    await tPage.waitForTimeout(2000);
    console.log('✅ Teacher shuffled');
    await snap(tPage, '04_teacher_after_shuffle');

    // ── Step 6: Verify room cards ──
    const roomCards = tPage.locator('[data-testid="breakout-room-card"]');
    const cardCount = await roomCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
    console.log(`✅ ${cardCount} room cards visible`);
    await snap(tPage, '05_teacher_room_cards');

    // ── Step 7: Student views in breakout ──
    await s1Page.waitForTimeout(2000);
    await s2Page.waitForTimeout(2000);
    const s1Text = await s1Page.locator('body').textContent();
    const s2Text = await s2Page.locator('body').textContent();
    console.log('📝 S1 text:', s1Text?.slice(0,180));
    console.log('📝 S2 text:', s2Text?.slice(0,180));
    await snap(s1Page, '06_student1_breakout');
    await snap(s2Page, '06_student2_breakout');

    // ── Step 8: Broadcast ──
    const broadcastBtn = tPage.getByRole('button', { name: /Broadcast Audio/i }).first();
    if (await broadcastBtn.isVisible().catch(() => false)) {
      await broadcastBtn.click();
      console.log('✅ Teacher started broadcast');
      await tPage.waitForTimeout(800);
      await snap(tPage, '07_teacher_broadcast_on');

      await s1Page.waitForTimeout(1000);
      await s2Page.waitForTimeout(1000);
      await snap(s1Page, '08_student1_broadcast');
      await snap(s2Page, '08_student2_broadcast');
    } else {
      console.log('⚠️ Broadcast button not visible');
    }

    // ── Step 9: Close All Rooms ──
    const closeBtn = tPage.getByRole('button', { name: /Close All Rooms/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      console.log('✅ Teacher closed rooms');
      await tPage.waitForTimeout(1000);
      await snap(tPage, '09_teacher_closed');
    } else {
      console.log('⚠️ Close All Rooms button not visible');
    }

    // ── Step 10: Students back to main ──
    await s1Page.waitForTimeout(2000);
    await s2Page.waitForTimeout(2000);
    await snap(s1Page, '10_student1_main');
    await snap(s2Page, '10_student2_main');

    console.log('\n✅ E2E flow complete!');

  } finally {
    try { await tCtx.close(); } catch (e) { /* ignore */ }
    try { await s1Ctx.close(); } catch (e) { /* ignore */ }
    try { await s2Ctx.close(); } catch (e) { /* ignore */ }
  }
});
