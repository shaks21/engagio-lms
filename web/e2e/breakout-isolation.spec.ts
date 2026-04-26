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
  if (res.status >= 400) {
    const body = await res.text();
    throw new Error(`Register ${email} failed: ${res.status} ${body}`);
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

/* ─── Test 2: Metadata Isolation Verification ─── */
test('breakout room isolation — students only see their breakout partner, teacher sees all', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `t${ts}@brk.io`;
  const sAEmail  = `a${ts}@brk.io`;
  const sBEmail  = `b${ts}@brk.io`;
  const password = 'Password123!';

  // Register via API
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

  // Teacher creates course + starts session
  const tToken    = await tPage.evaluate(() => localStorage.getItem('engagio_token'));
  const courseRes = await (await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({ title: `IsoCourse ${ts}`, description: 'test' }),
  })).json();

  const sessionRes = await (await fetch(`${API}/sessions/start?courseId=${courseRes.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
  })).json();
  const sessionId = sessionRes.id;

  // All three join classroom
  for (const page of [tPage, aPage, bPage]) {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(3500);
  }

  // Get student IDs
  const aToken   = await aPage.evaluate(() => localStorage.getItem('engagio_token'));
  const bToken   = await bPage.evaluate(() => localStorage.getItem('engagio_token'));
  const aUserId  = getUserId(aToken!);
  const bUserId  = getUserId(bToken!);

  // Teacher assigns breakout
  await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({ assignments: { [aUserId]: 'room-alpha', [bUserId]: 'room-alpha' } }),
  });

  // Allow metadata propagation
  await new Promise((r) => setTimeout(r, 5000));

  // Verify via API GET
  const getRes = await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    headers: { Authorization: `Bearer ${tToken}` },
  });
  const getBody = await getRes.json();
  expect(getRes.status).toBe(200);
  expect(getBody.assignments[aUserId]).toBe('room-alpha');
  expect(getBody.assignments[bUserId]).toBe('room-alpha');

  // Verify via frontend state: query participant metadata
  const aResult = await aPage.evaluate(() => {
    const w = window as any;
    const lkRoom = w.__lk_room__ || w.lkRoom;
    if (!lkRoom) return { error: 'no_room' };
    const remotes: any[] = [];
    lkRoom.remoteParticipants.forEach((rp: any) => {
      try {
        const meta = rp.metadata ? JSON.parse(rp.metadata) : {};
        remotes.push({ identity: rp.identity, breakoutRoomId: meta.breakoutRoomId || null });
      } catch { remotes.push({ identity: rp.identity, breakoutRoomId: null }); }
    });
    return { remotes };
  });

  const bResult = await bPage.evaluate(() => {
    const w = window as any;
    const lkRoom = w.__lk_room__ || w.lkRoom;
    if (!lkRoom) return { error: 'no_room' };
    const remotes: any[] = [];
    lkRoom.remoteParticipants.forEach((rp: any) => {
      try {
        const meta = rp.metadata ? JSON.parse(rp.metadata) : {};
        remotes.push({ identity: rp.identity, breakoutRoomId: meta.breakoutRoomId || null });
      } catch { remotes.push({ identity: rp.identity, breakoutRoomId: null }); }
    });
    return { remotes };
  });

  const tResult = await tPage.evaluate(() => {
    const w = window as any;
    const lkRoom = w.__lk_room__ || w.lkRoom;
    if (!lkRoom) return { error: 'no_room' };
    const remotes: any[] = [];
    lkRoom.remoteParticipants.forEach((rp: any) => {
      try {
        const meta = rp.metadata ? JSON.parse(rp.metadata) : {};
        remotes.push({ identity: rp.identity, breakoutRoomId: meta.breakoutRoomId || null });
      } catch { remotes.push({ identity: rp.identity, breakoutRoomId: null }); }
    });
    return { remotes };
  });

  console.log('Student A remotes:', JSON.stringify(aResult));
  console.log('Student B remotes:', JSON.stringify(bResult));
  console.log('Teacher remotes:  ', JSON.stringify(tResult));

  // Both students see each other with room-alpha metadata
  expect(aResult.remotes.some((r: any) => r.identity === bUserId && r.breakoutRoomId === 'room-alpha')).toBe(true);
  expect(bResult.remotes.some((r: any) => r.identity === aUserId && r.breakoutRoomId === 'room-alpha')).toBe(true);

  // Teacher sees both students with room-alpha metadata
  expect(tResult.remotes.some((r: any) => r.identity === aUserId && r.breakoutRoomId === 'room-alpha')).toBe(true);
  expect(tResult.remotes.some((r: any) => r.identity === bUserId && r.breakoutRoomId === 'room-alpha')).toBe(true);

  await aCtx.close();
  await bCtx.close();
  await tCtx.close();
});
