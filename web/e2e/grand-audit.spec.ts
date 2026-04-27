import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

/* ─── helpers ─── */
async function registerUserAPI(email: string, password = 'Password123!', role: 'TEACHER' | 'STUDENT') {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error(`Register failed: ${await res.text()}`);
  const json = await res.json() as any;
  return json.user?.id || json.id;
}

async function loginAPI(email: string, password = 'Password123!') {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
  const json = await res.json() as any;
  return json.accessToken as string;
}

async function loginBrowser(page: any, email: string, password = 'Password123!') {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15_000 });
}

async function createCourseAPI(teacherToken: string, title: string) {
  const res = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ title, description: 'grand audit' }),
  });
  if (!res.ok) throw new Error(`Course create failed: ${await res.text()}`);
  const json = await res.json() as any;
  return { courseId: json.id, tenantId: json.tenantId };
}

async function startSessionAPI(teacherToken: string, courseId: string) {
  const res = await fetch(`${API}/sessions/start?courseId=${courseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok) throw new Error(`Session start failed: ${await res.text()}`);
  const json = await res.json() as any;
  return json.id as string;
}

async function autoShuffleAPI(teacherToken: string, sessionId: string, groupCount: number) {
  const res = await fetch(`${API}/sessions/${sessionId}/breakouts/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ groupCount }),
  });
  if (!res.ok) throw new Error(`Auto shuffle failed: ${await res.text()}`);
  const json = await res.json() as any;
  return json.assignments as Record<string, string>;
}

async function clearBreakoutsAPI(teacherToken: string, sessionId: string) {
  const res = await fetch(`${API}/sessions/${sessionId}/breakouts/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok) throw new Error(`Clear breakouts failed: ${await res.text()}`);
}

async function endSessionAPI(teacherToken: string, sessionId: string) {
  const res = await fetch(`${API}/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
  });
  if (!res.ok) throw new Error(`End session failed: ${await res.text()}`);
}

async function getSessionEventsAPI(token: string, sessionId: string, type?: string) {
  const url = type
    ? `${API}/analytics/session/${sessionId}/events?type=${type}`
    : `${API}/analytics/session/${sessionId}/events`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Events fetch failed: ${await res.text()}`);
  return (await res.json()) as any[];
}

function getPM2MemoryMB(processName: string): number {
  try {
    const raw = execSync(`pm2 jlist`, { encoding: 'utf-8' });
    const list = JSON.parse(raw);
    const p = list.find((x: any) => x.name === processName);
    if (!p) return 0;
    return Math.round((p.monit?.memory || 0) / 1024 / 1024);
  } catch {
    return 0;
  }
}

async function joinClassroom(page: any, sessionId: string) {
  await page.goto(`${BASE}/classroom/${sessionId}`);
  await page.waitForTimeout(1500);
  const joinBtn = page.getByRole('button', { name: /Join/i }).first();
  if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
  await page.waitForTimeout(4000);
}

/* ─── Grand Audit: Full Session Journey ─── */
test('Grand Audit — full session journey: main room engagement, breakouts, broadcast, peek, hand raise, clear, end', async ({ browser }) => {
  test.setTimeout(240_000);
  const ts = Date.now();
  const tEmail = `t${ts}@audit.io`;
  const sEmails = [`s1${ts}@audit.io`, `s2${ts}@audit.io`, `s3${ts}@audit.io`, `s4${ts}@audit.io`];
  const password = 'Password123!';

  /* 1. Register */
  const tId = await registerUserAPI(tEmail, password, 'TEACHER');
  const sIds = await Promise.all(sEmails.map((e) => registerUserAPI(e, password, 'STUDENT')));

  /* 2. API setup */
  const teacherToken = await loginAPI(tEmail, password);
  const { courseId } = await createCourseAPI(teacherToken, `Audit ${ts}`);
  const sessionId = await startSessionAPI(teacherToken, courseId);

  /* 3. Browser contexts */
  const tCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const studentCtxs = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext()]);
  const tPage = await tCtx.newPage();
  const sPages = await Promise.all(studentCtxs.map((ctx) => ctx.newPage()));

  /* 4. Login */
  await loginBrowser(tPage, tEmail, password);
  for (let i = 0; i < sPages.length; i++) await loginBrowser(sPages[i], sEmails[i], password);

  const memBeforeAPI = getPM2MemoryMB('engagio-api');
  const memBeforeWeb = getPM2MemoryMB('engagio-web');
  console.log(`[MEM BASELINE] api=${memBeforeAPI}MB web=${memBeforeWeb}MB`);

  /* 5. Join classroom */
  await Promise.all([joinClassroom(tPage, sessionId), ...sPages.map((p) => joinClassroom(p, sessionId))]);
  await tPage.waitForTimeout(2000);

  /* 6. High engagement — raise + lower hands in Main Room */
  for (const sPage of sPages) {
    const raiseBtn = sPage.locator('button[aria-label*="Raise Hand"], button:has-text("Raise Hand"), button[title*="Raise Hand"]').first();
    if (await raiseBtn.isVisible().catch(() => false)) await raiseBtn.click();
  }
  await tPage.waitForTimeout(2000);
  for (const sPage of sPages) {
    const raiseBtn = sPage.locator('button[aria-label*="Raise Hand"], button:has-text("Raise Hand"), button[title*="Raise Hand"]').first();
    if (await raiseBtn.isVisible().catch(() => false)) await raiseBtn.click();
  }
  await tPage.waitForTimeout(1500);

  /* 7. Auto-shuffle into 2 rooms */
  const assignments = await autoShuffleAPI(teacherToken, sessionId, 2);
  console.log('Auto-shuffle assignments:', JSON.stringify(assignments));
  await tPage.waitForTimeout(4000);

  /* 8. Open breakout tab */
  const breakoutTabBtn = tPage.locator('[data-testid="sidebar-tab-breakout"]').first();
  if (await breakoutTabBtn.isVisible().catch(() => false)) {
    await breakoutTabBtn.click();
    await tPage.waitForTimeout(500);
  }

  /* Wait for room cards */
  await tPage.waitForSelector('[data-testid="breakout-room-card"]', { timeout: 10000 });

  /* Map room IDs */
  const roomCards = await tPage.locator('[data-testid="breakout-room-card"]').all();
  expect(roomCards.length).toBeGreaterThanOrEqual(2);
  const rawTexts = await Promise.all(roomCards.map(async (card) => {
    const text = await card.textContent();
    return text || '';
  }));
  console.log('Card texts:', JSON.stringify(rawTexts));
  const roomIdMatches = rawTexts
    .flatMap((txt) => Array.from(txt.matchAll(/room-[a-z]+/gi) || []))
    .map((m) => m[0]);
  const deduped = [...new Set(roomIdMatches.filter((r) => /^room-[a-z]$/i.test(r)))];
  const room1 = deduped[0];
  const room2 = deduped[1];
  console.log(`Rooms discovered: ${room1}, ${room2}`);
  expect(room1).toBeTruthy();
  expect(room2).toBeTruthy();

  await tPage.waitForTimeout(3000);

  /* 9. Broadcast toggle ON */
  const broadcastBtn = tPage.getByRole('button', { name: /Broadcast Audio/i }).first();
  await broadcastBtn.click();
  await tPage.waitForTimeout(1500);
  console.log('Broadcast toggled ON');

  /* 10. Turn broadcast OFF */
  const stopBcastBtn = tPage.getByRole('button', { name: /Stop Broadcast/i }).first();
  await stopBcastBtn.click();
  await tPage.waitForTimeout(1000);

  /* 11. Invisible PEEK room 1 */
  const peekToggle = tPage.locator('[data-testid="peek-visibility-toggle"]').first();
  const peekChecked = await peekToggle.isChecked().catch(() => true);
  if (!peekChecked) await peekToggle.click();

  const monitorBtn1 = tPage.locator(`[data-testid="monitor-room-${room1}"]`).first();
  await monitorBtn1.click();
  await tPage.waitForTimeout(2000);

  const monitorState1 = await tPage.evaluate(() => (window as any).__breakoutState);
  console.log('Monitor state after peek:', JSON.stringify(monitorState1));
  expect(monitorState1?.isMonitoring).toBe(true);
  expect(monitorState1?.monitorTarget).toBe(room1);
  expect(monitorState1?.peekMode).not.toBe(false);

  /* Stop monitor */
  const stopMonitorBtn = tPage.locator('[data-testid="stop-monitor"]').first();
  await stopMonitorBtn.click();
  await tPage.waitForTimeout(1500);

  /* 12. ACTIVE JOIN room 2 (turn off peek mode = visible join) */
  const notifyToggle = tPage.locator('[data-testid="notify-students-toggle"]').first();
  const notifyChecked = await notifyToggle.isChecked().catch(() => false);
  if (!notifyChecked) await notifyToggle.click();
  await tPage.waitForTimeout(500);

  const monitorBtn2 = tPage.locator(`[data-testid="monitor-room-${room2}"]`).first();
  await monitorBtn2.click();
  await tPage.waitForTimeout(2000);

  const monitorState2 = await tPage.evaluate(() => (window as any).__breakoutState);
  console.log('Monitor state after active join:', JSON.stringify(monitorState2));
  expect(monitorState2?.isMonitoring).toBe(true);
  expect(monitorState2?.monitorTarget).toBe(room2);
  expect(monitorState2?.peekMode).toBe(false);

  /* 13. Student in room 2 raises hand */
  const studentInRoom2 = sIds.find((sid) => assignments[sid] === room2);
  const sRoom2Page = sPages[sIds.indexOf(studentInRoom2!)];
  const raiseBtn2 = sRoom2Page.locator('button[aria-label*="Raise Hand"], button:has-text("Raise Hand"), button[title*="Raise Hand"]').first();
  await raiseBtn2.click();
  await sRoom2Page.waitForTimeout(3000);

  /* 14. Clear breakouts */
  await clearBreakoutsAPI(teacherToken, sessionId);
  await tPage.waitForTimeout(3000);

  /* 15. End session */
  await endSessionAPI(teacherToken, sessionId);
  await tPage.waitForTimeout(2000);

  /* 16. Memory stability check */
  const memAfterAPI = getPM2MemoryMB('engagio-api');
  const memAfterWeb = getPM2MemoryMB('engagio-web');
  const apiDelta = memAfterAPI - memBeforeAPI;
  const webDelta = memAfterWeb - memBeforeWeb;
  console.log(`[MEM FINAL] api=${memAfterAPI}MB (Δ${apiDelta}MB) web=${memAfterWeb}MB (Δ${webDelta}MB)`);
  expect(apiDelta).toBeLessThan(500);
  expect(webDelta).toBeLessThan(500);

  /* 17. Event timeline validation */
  await tPage.waitForTimeout(8000);
  const allEvents = await getSessionEventsAPI(teacherToken, sessionId);
  console.log('All events count:', allEvents.length);

  const handRaises = allEvents.filter((e) => e.type === 'HAND_RAISE');
  console.log('HAND_RAISE events:', handRaises.length);
  expect(handRaises.length).toBeGreaterThanOrEqual(4);

  const timeline = handRaises.map((e) => ({
    type: e.type,
    timestamp: e.timestamp,
    breakoutRoomId: (e.payload as Record<string, any>)?.breakoutRoomId ?? null,
    raised: (e.payload as Record<string, any>)?.raised ?? null,
  }));
  console.log('Timeline:', JSON.stringify(timeline, null, 2));

  const hasNull = timeline.some((t) => t.breakoutRoomId === null || t.breakoutRoomId === undefined);
  const hasRoom1 = timeline.some((t) => t.breakoutRoomId === room1);
  const hasRoom2 = timeline.some((t) => t.breakoutRoomId === room2);
  console.log(`Timeline coverage — null:${hasNull} room1:${hasRoom1} room2:${hasRoom2}`);
  expect(hasNull).toBe(true);
  expect(hasRoom2).toBe(true);

  /* Cleanup */
  await tCtx.close();
  for (const ctx of studentCtxs) await ctx.close();
});
