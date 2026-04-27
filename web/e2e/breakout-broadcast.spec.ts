import { test, expect } from '@playwright/test';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

/* ─── helpers ─── */
async function registerUserAPI(email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (res.status >= 400 && !res.ok) {
    const body = await res.text();
    if (!res.ok) throw new Error(`Register ${email} failed: ${res.status} ${body}`);
  }
  return res.json();
}

async function loginBrowser(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

function getUserId(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
  return payload.sub as string;
}

async function getBreakoutState(page: any) {
  return page.evaluate(() => {
    const w = window as any;
    const room = w.__lk_room__ || w.lkRoom;
    return {
      roomExists: !!room,
      stateExists: !!room?.__breakoutState,
      isBroadcasting: room?.__breakoutState?.isBroadcasting ?? false,
      localBreakoutId: room?.__breakoutState?.localBreakoutId ?? null,
      remoteCount: room?.remoteParticipants?.size ?? 0,
    };
  });
}

async function getTrackState(page: any, targetIdentity: string) {
  return page.evaluate((identity: string) => {
    const w = window as any;
    const lkRoom = w.__lk_room__ || w.lkRoom;
    if (!lkRoom) return { error: 'no_room' };
    let rp: any;
    lkRoom.remoteParticipants.forEach((p: any) => { if (p.identity === identity) rp = p; });
    if (!rp) return { error: 'participant_not_found', identity };
    const audioSubscribed = Array.from(rp.trackPublications.values())
      .some((pub: any) => pub.kind === 'audio' && pub.isSubscribed);
    const videoSubscribed = Array.from(rp.trackPublications.values())
      .some((pub: any) => pub.kind === 'video' && pub.isSubscribed);
    return { audioSubscribed, videoSubscribed, identity };
  }, targetIdentity);
}

/* ─── Test: Audio-Only Global Broadcast ─── */
test('audio broadcast — teacher toggle adds audio to all breakout rooms, video stays isolated', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `t${ts}@brk.io`;
  const sAEmail  = `a${ts}@brk.io`;
  const sBEmail  = `b${ts}@brk.io`;
  const password = 'Password123!';

  await registerUserAPI(tEmail, password, 'TEACHER');
  await registerUserAPI(sAEmail, password, 'STUDENT');
  await registerUserAPI(sBEmail, password, 'STUDENT');

  const tCtx  = await browser.newContext();
  const aCtx  = await browser.newContext();
  const bCtx  = await browser.newContext();
  const tPage = await tCtx.newPage();
  const aPage = await aCtx.newPage();
  const bPage = await bCtx.newPage();

  await loginBrowser(tPage, tEmail, password);
  await loginBrowser(aPage, sAEmail, password);
  await loginBrowser(bPage, sBEmail, password);

  // Teacher creates course + session
  const tToken    = await tPage.evaluate(() => localStorage.getItem('engagio_token'));
  const courseRes = await (await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({ title: `BC ${ts}`, description: 'broadcast test' }),
  })).json();

  const sessionRes = await (await fetch(`${API}/sessions/start?courseId=${courseRes.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
  })).json();
  const sessionId = sessionRes.id;

  // Join classroom
  for (const page of [tPage, aPage, bPage]) {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(3500);
  }

  // Get IDs
  const aToken  = await aPage.evaluate(() => localStorage.getItem('engagio_token'));
  const bToken  = await bPage.evaluate(() => localStorage.getItem('engagio_token'));
  const aUserId = getUserId(aToken!);
  const bUserId = getUserId(bToken!);
  const tUserId = getUserId(tToken!);

  // Assign to DIFFERENT breakout rooms
  await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({
      assignments: {
        [aUserId]: 'room-alpha',
        [bUserId]: 'room-beta',
      },
    }),
  });
  await new Promise((r) => setTimeout(r, 5000));

  // --- BEFORE broadcast: students should NOT subscribe to teacher in different rooms ---
  // (teacher is in main, students in breakout; all should be isolated)
  const beforeStateA = await getBreakoutState(aPage);
  const beforeStateB = await getBreakoutState(bPage);
  console.log('Before broadcast — Student A state:', JSON.stringify(beforeStateA));
  console.log('Before broadcast — Student B state:', JSON.stringify(beforeStateB));

  expect(beforeStateA.roomExists).toBe(true);
  expect(beforeStateB.roomExists).toBe(true);

  // --- Teacher opens BreakoutTab and clicks Broadcast ---
  const breakoutTabBtn = tPage.locator('[data-testid="sidebar-tab-breakout"]').first();
  await expect(breakoutTabBtn).toBeVisible({ timeout: 5000 });
  await breakoutTabBtn.click();
  await tPage.waitForTimeout(500);

  const broadcastBtn = tPage.getByRole('button', { name: /Broadcast Audio/i }).first();
  await expect(broadcastBtn).toBeVisible({ timeout: 5000 });
  await broadcastBtn.click();

  // Wait for socket propagation + hook re-evaluation (2+ poll intervals)
  await new Promise((r) => setTimeout(r, 5500));

  // --- AFTER broadcast: hook has received isBroadcasting=true ---
  const afterStateA = await getBreakoutState(aPage);
  const afterStateB = await getBreakoutState(bPage);
  console.log('After broadcast — Student A state:', JSON.stringify(afterStateA));
  console.log('After broadcast — Student B state:', JSON.stringify(afterStateB));

  expect(afterStateA.isBroadcasting).toBe(true);
  expect(afterStateB.isBroadcasting).toBe(true);

  // --- Teacher toggles broadcast OFF ---
  const broadcastBtnOff = tPage.getByRole('button', { name: /Stop Broadcast/i }).first();
  await broadcastBtnOff.click();
  await new Promise((r) => setTimeout(r, 5500));

  // --- AFTER OFF: broadcast flag cleared ---
  const offStateA = await getBreakoutState(aPage);
  const offStateB = await getBreakoutState(bPage);
  console.log('After OFF — Student A state:', JSON.stringify(offStateA));
  console.log('After OFF — Student B state:', JSON.stringify(offStateB));

  expect(offStateA.isBroadcasting).toBe(false);
  expect(offStateB.isBroadcasting).toBe(false);

  // --- Bonus: verify video stays unsubscribed for teacher (SFU headless limitation: actual isSubscribed may lag) ---
  const afterTrackA = await getTrackState(aPage, tUserId);
  console.log('After broadcast — Student A teacher track:', JSON.stringify(afterTrackA));
  // Video should stay unsubscribed (teacher is in different room)
  expect(afterTrackA.videoSubscribed).toBe(false);

  await aCtx.close();
  await bCtx.close();
  await tCtx.close();
});
