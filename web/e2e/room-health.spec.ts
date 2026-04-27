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

/* ─── Test: Room Health Badges ─── */
test('breakout room health — badges show average engagement per room', async ({ browser }) => {
  const ts       = Date.now();
  const tEmail   = `t${ts}@brk.io`;
  const sAEmail  = `a${ts}@brk.io`;
  const sBEmail  = `b${ts}@brk.io`;
  const sCEmail  = `c${ts}@brk.io`;
  const password = 'Password123!';

  await registerUserAPI(tEmail, password, 'TEACHER');
  await registerUserAPI(sAEmail, password, 'STUDENT');
  await registerUserAPI(sBEmail, password, 'STUDENT');
  await registerUserAPI(sCEmail, password, 'STUDENT');

  const tCtx  = await browser.newContext();
  const aCtx  = await browser.newContext();
  const bCtx  = await browser.newContext();
  const cCtx  = await browser.newContext();
  const tPage = await tCtx.newPage();
  const aPage = await aCtx.newPage();
  const bPage = await bCtx.newPage();
  const cPage = await cCtx.newPage();

  await loginBrowser(tPage, tEmail, password);
  await loginBrowser(aPage, sAEmail, password);
  await loginBrowser(bPage, sBEmail, password);
  await loginBrowser(cPage, sCEmail, password);

  // Teacher creates course + session
  const tToken    = await tPage.evaluate(() => localStorage.getItem('engagio_token'));
  const courseRes = await (await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({ title: `RH ${ts}`, description: 'room health test' }),
  })).json();

  const sessionRes = await (await fetch(`${API}/sessions/start?courseId=${courseRes.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
  })).json();
  const sessionId = sessionRes.id;

  // All join classroom
  for (const page of [tPage, aPage, bPage, cPage]) {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(3500);
  }

  // Get IDs
  const aToken  = await aPage.evaluate(() => localStorage.getItem('engagio_token'));
  const bToken  = await bPage.evaluate(() => localStorage.getItem('engagio_token'));
  const cToken  = await cPage.evaluate(() => localStorage.getItem('engagio_token'));
  const aUserId = getUserId(aToken!);
  const bUserId = getUserId(bToken!);
  const cUserId = getUserId(cToken!);

  // Assign breakout rooms
  await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tToken}` },
    body: JSON.stringify({
      assignments: {
        [aUserId]: 'room-alpha',
        [bUserId]: 'room-alpha',
        [cUserId]: 'room-beta',
      },
    }),
  });
  await new Promise((r) => setTimeout(r, 4000));

  // Teacher opens BreakoutTab
  const breakoutTabBtn = tPage.locator('[data-testid="sidebar-tab-breakout"]').first();
  if (await breakoutTabBtn.isVisible().catch(() => false)) {
    await breakoutTabBtn.click();
    await tPage.waitForTimeout(500);
  }

  // Wait for room cards to render
  await tPage.waitForSelector('[data-testid="breakout-room-card"]', { timeout: 10000 });

  // Both room cards should be visible
  const cards = tPage.locator('[data-testid="breakout-room-card"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(2);

  // room-alpha card: verify health badge exists
  const alphaCard = cards.filter({ hasText: /room-alpha/i }).first();
  await expect(alphaCard).toBeVisible();
  await expect(alphaCard).toContainText('room-alpha');

  // Health dot must exist on every card
  const dots = cards.locator('[data-testid="room-health-dot"]');
  expect(await dots.count()).toBeGreaterThanOrEqual(2);

  // Verify health dot data-status attribute is valid (green/yellow/red)
  const statuses = await dots.evaluateAll((els: HTMLElement[]) =>
    els.map((el) => el.getAttribute('data-status'))
  );
  for (const s of statuses) {
    expect(['green', 'yellow', 'red']).toContain(s);
  }

  // room-beta card must exist
  const betaCard = cards.filter({ hasText: /room-beta/i }).first();
  await expect(betaCard).toBeVisible();

  await aCtx.close();
  await bCtx.close();
  await cCtx.close();
  await tCtx.close();
});
