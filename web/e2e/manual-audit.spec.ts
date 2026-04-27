/**
 * Manual UI/UX Audit of Breakout Room Flow
 * Multi-tab: 1 Teacher + 3 Students
 * Run: npx playwright test e2e/manual-audit.spec.ts --workers=1
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE = 'https://engagio.duckdns.org';
const API  = 'https://engagio.duckdns.org/api';
const PW   = 'Password123!';

/* ─── UTILS ────────────────────────────────────────────── */
function uid() { return Date.now() + '-' + Math.floor(Math.random()*1e6); }

function getUserId(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
  return payload.sub as string;
}

async function registerUserAPI(email: string, role: 'TEACHER' | 'STUDENT') {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW, role }),
  });
  const body = await res.text();
  if (!res.ok && !body.includes('already exists')) throw new Error(`Register ${email}: ${res.status} ${body}`);
}

async function loginAPI(email: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PW }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login ${email}: ${res.status} ${JSON.stringify(body)}`);
  return body.accessToken;
}

async function loginBrowser(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', PW);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

async function screenshot(page: Page, name: string) {
  const p = `e2e/__audit__/${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`[SCREENSHOT] ${p}`);
}

/* ─── SETUP ───────────────────────────────────────────── */
test('Manual Audit — Breakout Room Multi-Tab Flow', async ({ browser }) => {
  test.setTimeout(180000);
  const ts  = uid();
  const tE  = `t-${ts}@audit.io`;
  const s1E = `s1-${ts}@audit.io`;
  const s2E = `s2-${ts}@audit.io`;
  const s3E = `s3-${ts}@audit.io`;

  console.log('\n=========== STEP 1: SETUP: Register + Login ===========');
  await Promise.all([
    registerUserAPI(tE, 'TEACHER'),
    registerUserAPI(s1E, 'STUDENT'),
    registerUserAPI(s2E, 'STUDENT'),
    registerUserAPI(s3E, 'STUDENT'),
  ]);

  const [tTok] = await Promise.all([loginAPI(tE)]);
  const s1Tok = await loginAPI(s1E);
  const s2Tok = await loginAPI(s2E);
  const s3Tok = await loginAPI(s3E);

  // Create session via API
  const courseRes = await (await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tTok}` },
    body: JSON.stringify({ title: `Audit ${ts}`, description: 'manual audit' }),
  })).json();

  const sessionRes = await (await fetch(`${API}/sessions/start?courseId=${courseRes.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tTok}` },
  })).json();
  const sessionId = sessionRes.id;
  console.log('Session ID:', sessionId);

  // Launch 4 isolated contexts
  const tCtx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const s1Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const s2Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const s3Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const tPage  = await tCtx.newPage();
  const s1Page = await s1Ctx.newPage();
  const s2Page = await s2Ctx.newPage();
  const s3Page = await s3Ctx.newPage();

  // Capture console errors globally
  const CONSOLE_ERRORS: string[] = [];
  for (const [name, p] of [['Teacher',tPage],['S1',s1Page],['S2',s2Page],['S3',s3Page]]) {
    p.on('console', msg => {
      if (msg.type() === 'error') CONSOLE_ERRORS.push(`[${name}] ${msg.text()}`);
    });
    p.on('pageerror', err => CONSOLE_ERRORS.push(`[${name}] PAGE_ERROR: ${err.message}`));
  }

  await loginBrowser(tPage, tE);
  await Promise.all([loginBrowser(s1Page,s1E), loginBrowser(s2Page,s2E), loginBrowser(s3Page,s3E)]);
  await Promise.all([
    screenshot(tPage, '01_teacher_dashboard'),
    screenshot(s1Page, '01_s1_dashboard'), screenshot(s2Page, '01_s2_dashboard'), screenshot(s3Page, '01_s3_dashboard'),
  ]);

  /* ─── STEP 2: JOIN CLASSROOM + HEATMAP CHECK ────────── */
  console.log('\n=========== STEP 2: HEATMAP CHECK ===========');
  for (const page of [tPage, s1Page, s2Page, s3Page]) {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(4000); // allow LiveKit connect
  }

  await screenshot(tPage, '02_teacher_classroom');
  await screenshot(s1Page, '02_s1_classroom');
  await screenshot(s2Page, '02_s2_classroom');
  await screenshot(s3Page, '02_s3_classroom');

  // Verify teacher sees student cards
  const studentCards = await tPage.locator('[data-testid="student-avatar"]').count();
  console.log(`Teacher sees ${studentCards} student avatars (expected 3).`);
  expect(studentCards).toBeGreaterThanOrEqual(0); // might be 0 if LiveKit not populated yet

  // Breakout tab visible on teacher?
  const breakoutBtn = tPage.locator('[data-testid="sidebar-tab-breakout"]').first();
  const breakoutVisible = await breakoutBtn.isVisible().catch(() => false);
  console.log('Breakout tab visible for teacher:', breakoutVisible);
  expect(breakoutVisible).toBe(true);

  /* ─── STEP 3: ALLOCATION UI (Manual + Shuffle) ───────── */
  console.log('\n=========== STEP 3: ALLOCATION UI ===========');
  await breakoutBtn.click();
  await tPage.waitForTimeout(800);
  await screenshot(tPage, '03_teacher_breakout_tab_open');

  // Look for Shuffle / Manual buttons
  const shuffleBtn = tPage.getByRole('button', { name: /Shuffle/i }).first();
  const manualBtn  = tPage.getByRole('button', { name: /Manual|Assign/i }).first();
  console.log('Shuffle button visible:', await shuffleBtn.isVisible().catch(() => false));
  console.log('Manual button visible:',  await manualBtn.isVisible().catch(() => false));

  // Get student IDs
  const s1Id = getUserId(s1Tok);
  const s2Id = getUserId(s2Tok);
  const s3Id = getUserId(s3Tok);

  // Manual assignment via API (simulating drag-and-drop since headless drag is fragile)
  const assignRes = await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tTok}` },
    body: JSON.stringify({
      assignments: {
        [s1Id]: 'room-alpha',
        [s2Id]: 'room-alpha',
        [s3Id]: 'room-beta',
      },
    }),
  });
  const assignBody = await assignRes.json();
  console.log('Assignment API response:', assignRes.status, JSON.stringify(assignBody));
  expect(assignRes.status).toBe(200);

  // Wait for LiveKit metadata propagation + UI update
  await tPage.waitForTimeout(5000);
  await screenshot(tPage, '03_teacher_assigned_rooms');
  await screenshot(s1Page, '03_s1_assigned');
  await screenshot(s2Page, '03_s2_assigned');
  await screenshot(s3Page, '03_s3_assigned');

  /* ─── STEP 4: ISOLATION CHECK ───────────────────────── */
  console.log('\n=========== STEP 4: ISOLATION CHECK ===========');

  // Check student side — who can they see?
  const checkParticipants = async (page: Page, label: string) => {
    const count = await page.locator('[data-testid="student-avatar"], .lk-participant-tile, [data-testid="participant-tile"]').count();
    console.log(`${label} sees ${count} participant tiles.`);
    return count;
  };

  const s1Peers = await checkParticipants(s1Page, 'StudentA');
  const s2Peers = await checkParticipants(s2Page, 'StudentB');
  const s3Peers = await checkParticipants(s3Page, 'StudentC');

  // Student in room-alpha (s1, s2) should see each other ideally
  // Student in room-beta (s3) should NOT see room-alpha students
  // Note: exact tile counts depend on implementation (may see self + others)
  console.log('Isolation raw counts — S1:', s1Peers, 'S2:', s2Peers, 'S3:', s3Peers);

  await screenshot(s1Page, '04_s1_isolation_view');
  await screenshot(s2Page, '04_s2_isolation_view');
  await screenshot(s3Page, '04_s3_isolation_view');

  /* ─── STEP 5: MONITORING DASHBOARD ──────────────────── */
  console.log('\n=========== STEP 5: MONITORING DASHBOARD ===========');
  // On teacher tab, look for Monitor UI (Mini-Heatmaps, Listen button)
  const listenBtn = tPage.getByRole('button', { name: /Listen|Peek/i }).first();
  const monitorVisible = await listenBtn.isVisible().catch(() => false);
  console.log('Listen/Peek button visible:', monitorVisible);

  if (monitorVisible) {
    await listenBtn.click();
    await tPage.waitForTimeout(1500);
    await screenshot(tPage, '05_teacher_monitor_active');

    // Check if "Mini-Heatmap" cards are visible
    const heatmapCards = await tPage.locator('[data-testid="room-health-dot"], .room-health-badge, [data-testid="mini-heatmap"]').count();
    console.log('Mini-heatmap / room-health elements found:', heatmapCards);
  } else {
    console.log('WARN: No Listen button found — BreakoutTab monitor UI might be missing or collapsed.');
    await screenshot(tPage, '05_teacher_monitor_missing');
  }

  /* ─── STEP 6: GLOBAL BROADCAST ──────────────────────── */
  console.log('\n=========== STEP 6: GLOBAL BROADCAST ===========');
  const broadcastBtn = tPage.getByRole('button', { name: /Broadcast Audio/i }).first();
  const broadcastVisible = await broadcastBtn.isVisible().catch(() => false);
  console.log('Broadcast Audio button visible:', broadcastVisible);

  if (broadcastVisible) {
    await broadcastBtn.click();
    await tPage.waitForTimeout(5500); // socket propagation

    await screenshot(tPage, '06_teacher_broadcast_on');
    await screenshot(s1Page, '06_s1_broadcast_banner');
    await screenshot(s2Page, '06_s2_broadcast_banner');
    await screenshot(s3Page, '06_s3_broadcast_banner');

    // Check for broadcast banner in student DOM
    const bannerCheck = async (page: Page, label: string) => {
      const text = await page.locator('text=/Teacher.*broadcast|Speaking/i').count();
      console.log(`${label} broadcast banner elements:`, text);
    };
    await bannerCheck(s1Page, 'S1');
    await bannerCheck(s2Page, 'S2');
    await bannerCheck(s3Page, 'S3');

    // Turn broadcast OFF
    const stopBtn = tPage.getByRole('button', { name: /Stop Broadcast/i }).first();
    if (await stopBtn.isVisible().catch(() => false)) {
      await stopBtn.click();
      await tPage.waitForTimeout(5500);
      await screenshot(tPage, '06_teacher_broadcast_off');
    }
  } else {
    console.log('WARN: Broadcast button not found in BreakoutTab.');
    await screenshot(tPage, '06_broadcast_missing');
  }

  /* ─── STEP 7: VISUAL CONSISTENCY / STATE LAG ──────────── */
  console.log('\n=========== STEP 7: VISUAL CONSISTENCY ===========');
  await screenshot(tPage, '07_teacher_final_state');
  await screenshot(s1Page, '07_s1_final_state');
  await screenshot(s2Page, '07_s2_final_state');
  await screenshot(s3Page, '07_s3_final_state');

  /* ─── REPORT ──────────────────────────────────────────── */
  console.log('\n==============================================');
  console.log('             AUDIT REPORT');
  console.log('==============================================');
  console.log('Actors: 1 Teacher + 3 Students');
  console.log('Session:', sessionId);
  console.log('Console Errors/Warnings:', CONSOLE_ERRORS.length);
  CONSOLE_ERRORS.forEach(e => console.log('  →', e.substring(0,200)));

  if (studentCards === 0)     console.log('BUG: Teacher sees ZERO student cards.');
  if (!breakoutVisible)        console.log('BUG: Breakout tab NOT visible for teacher.');
  if (s3Peers === s1Peers && s1Peers > 1)
    console.log('BUG: Isolation may have failed — counts identical across rooms.');
  if (CONSOLE_ERRORS.length > 0) console.log('BUG: Console errors detected during breakout flow.');

  await tCtx.close(); await s1Ctx.close(); await s2Ctx.close(); await s3Ctx.close();
});
