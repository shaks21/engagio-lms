import { test, expect } from '@playwright/test';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

async function registerUserAPI(email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error(`Register failed: ${await res.text()}`);
  const json = await res.json() as any;
  return json.user?.id || json.id;
}

async function loginAPI(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json() as any;
  return json.accessToken as string;
}

async function loginBrowser(page: any, email: string, password: string) {
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
    body: JSON.stringify({ title, description: 'test' }),
  });
  const json = await res.json() as any;
  return { courseId: json.id, tenantId: json.tenantId };
}

async function startSessionAPI(teacherToken: string, courseId: string) {
  const res = await fetch(`${API}/sessions/start?courseId=${courseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
  });
  const json = await res.json() as any;
  return json.id as string;
}

async function assignBreakoutsAPI(token: string, sessionId: string, assignments: Record<string, string>) {
  const res = await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assignments }),
  });
  if (!res.ok) throw new Error(`Assign failed: ${await res.text()}`);
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

/* ─── Test: Breakout Room Data Persistence ─── */
test('breakout room data persistence — engagement events store breakoutRoomId', async ({ browser }) => {
  const ts     = Date.now();
  const tEmail = `t${ts}@persist.io`;
  const sEmail = `s${ts}@persist.io`;
  const password = 'Password123!';

  /* 1️⃣  Register users */
  const [tId, sId] = await Promise.all([
    registerUserAPI(tEmail, password, 'TEACHER'),
    registerUserAPI(sEmail, password, 'STUDENT'),
  ]);

  /* 2️⃣  Get tokens for API calls */
  const [teacherToken, studentToken] = await Promise.all([
    loginAPI(tEmail, password),
    loginAPI(sEmail, password),
  ]);

  const tCtx = await browser.newContext();
  const sCtx = await browser.newContext();
  const tPage = await tCtx.newPage();
  const sPage = await sCtx.newPage();

  /* 3️⃣  Login in browsers */
  await loginBrowser(tPage, tEmail, password);
  await loginBrowser(sPage, sEmail, password);

  /* 4️⃣  API setup */
  const { courseId, tenantId } = await createCourseAPI(teacherToken, `Persist Course ${ts}`);
  const sessionId = await startSessionAPI(teacherToken, courseId);

  /* 5️⃣  Join classroom */
  const joinClassroom = async (page: any) => {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(5000);
  };

  await Promise.all([joinClassroom(tPage), joinClassroom(sPage)]);
  await tPage.waitForTimeout(3000);

  /* 6️⃣  Assign student to room-c */
  await assignBreakoutsAPI(teacherToken, sessionId, { [sId]: 'c', [tId]: 'main' });
  await tPage.waitForTimeout(3000);

  /* 7️⃣  Student raises hand */
  const raiseButton = sPage.locator('button[aria-label*="Raise Hand"], button:has-text("Raise Hand"), button svg.lucide-hand').first();
  await raiseButton.click();
  await sPage.waitForTimeout(2000);

  /* Give socket/Kafka pipeline time */
  await sPage.waitForTimeout(6000);

  /* 8️⃣  Query events via API for HAND_RAISE */
  const events = await getSessionEventsAPI(teacherToken, sessionId, 'HAND_RAISE');

  console.log('HAND_RAISE events returned by API:', JSON.stringify(events));

  expect(events.length).toBeGreaterThan(0);

  const event = events[0];
  const payload = event.payload as Record<string, any>;
  console.log('Event payload:', JSON.stringify(payload));

  expect(payload.breakoutRoomId).toBe('c');

  /* Cleanup */
  await tCtx.close();
  await sCtx.close();
});
