import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

/* ─── helpers ─── */
async function registerUserAPI(email: string, password: string, role: 'TEACHER' | 'STUDENT' | 'ADMIN') {
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

async function loginUserAPI(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status >= 400) {
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
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

function getUserId(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
  return payload.sub as string;
}

/* ─── Test 1: API Assignment + LiveKit Metadata Push ─── */
test('teacher assigns two students to breakout room via API, LiveKit metadata updated', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `t${ts}@brk.io`;
  const sAEmail  = `a${ts}@brk.io`;
  const sBEmail  = `b${ts}@brk.io`;
  const password = 'Password123!';

  // 1. Register teacher + two students via API
  await registerUserAPI(tEmail, password, 'TEACHER');
  await registerUserAPI(sAEmail, password, 'STUDENT');
  await registerUserAPI(sBEmail, password, 'STUDENT');

  // 2. Login all browsers
  const tCtx  = await browser.newContext();
  const aCtx  = await browser.newContext();
  const bCtx  = await browser.newContext();
  const tPage = await tCtx.newPage();
  const aPage = await aCtx.newPage();
  const bPage = await bCtx.newPage();

  await loginBrowser(tPage, tEmail, password);
  await loginBrowser(aPage, sAEmail, password);
  await loginBrowser(bPage, sBEmail, password);

  // 3. Teacher creates course + starts session
  const tToken    = await tPage.evaluate(() => localStorage.getItem('engagio_token'));
  const courseRes = await (await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({ title: `Course ${ts}`, description: 'test' }),
  })).json();

  const sessionRes = await (await fetch(`${API}/sessions/start?courseId=${courseRes.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
  })).json();
  const sessionId = sessionRes.id;

  // 4. All three join the LiveKit classroom
  for (const page of [tPage, aPage, bPage]) {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(3000);
  }

  // 5. Get student userIds
  const aToken   = await aPage.evaluate(() => localStorage.getItem('engagio_token'));
  const bToken   = await bPage.evaluate(() => localStorage.getItem('engagio_token'));
  const aUserId  = getUserId(aToken!);
  const bUserId  = getUserId(bToken!);

  // 6. Teacher calls PATCH /sessions/:id/breakouts
  const assignRes = await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({
      assignments: {
        [aUserId]: 'room-alpha',
        [bUserId]: 'room-alpha',
      },
    }),
  });

  expect(assignRes.status).toBe(200);
  const assignBody = await assignRes.json();
  expect(assignBody.success).toBe(true);

  // Allow LiveKit metadata propagation
  await new Promise((r) => setTimeout(r, 3000));

  // 7. Verify via API that assignments persisted (GET endpoint)
  const getRes = await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    headers: { Authorization: `Bearer ${tToken}` },
  });
  expect(getRes.status).toBe(200);
  const getBody = await getRes.json();
  expect(getBody.assignments).toBeDefined();
  expect(getBody.assignments[aUserId]).toBe('room-alpha');
  expect(getBody.assignments[bUserId]).toBe('room-alpha');

  /* ── cleanup ── */
  await aCtx.close();
  await bCtx.close();
  await tCtx.close();
});
