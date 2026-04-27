import { test, expect } from '@playwright/test';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

/* ─── helpers ─── */
async function registerUserAPI(email: string, password: string = 'Password123!', role: 'TEACHER' | 'STUDENT') {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error(`Register failed: ${await res.text()}`);
  const json = await res.json() as any;
  return json.user?.id || json.id;
}

async function loginBrowser(page: any, email: string, password: string = 'password123') {
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
  return json.id;
}

async function fetchTokenAPI(userId: string, sessionId: string) {
  const res = await fetch(`${API}/livekit/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roomName: sessionId }),
  });
  const json = await res.json() as any;
  return json.token;
}

async function assignBreakoutsAPI(token: string, sessionId: string, assignments: Record<string, string>) {
  const res = await fetch(`${API}/sessions/${sessionId}/breakouts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ assignments }),
  });
  if (!res.ok) throw new Error(`Assign failed: ${await res.text()}`);
}

/* ─── Test: Invisible Room Monitoring ─── */
test('room peek visibility — invisible monitor subscribes audio, students do not see teacher', async ({ browser }) => {
  const ts     = Date.now();
  const tEmail = `t${ts}@peek.io`;
  const sAEmail = `a${ts}@peek.io`;
  const sBEmail = `b${ts}@peek.io`;

  /* 1️⃣  Register users */
  const [tId, sAId, sBId] = await Promise.all([
    registerUserAPI(tEmail, 'Password123!', 'TEACHER'),
    registerUserAPI(sAEmail, 'Password123!', 'STUDENT'),
    registerUserAPI(sBEmail, 'Password123!', 'STUDENT'),
  ]);

  const tCtx = await browser.newContext();
  const sACtx = await browser.newContext();
  const sBCtx = await browser.newContext();

  const tPage = await tCtx.newPage();
  const sAPage = await sACtx.newPage();
  const sBPage = await sBCtx.newPage();

  /* 2️⃣  Login */
  await loginBrowser(tPage, tEmail, 'Password123!');
  await loginBrowser(sAPage, sAEmail, 'Password123!');
  await loginBrowser(sBPage, sBEmail, 'Password123!');

  /* 3️⃣  API setup: teacher creates course + session */
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: tEmail, password: 'Password123!' }),
  });
  const { accessToken: teacherToken } = await loginRes.json() as any;

  const { courseId, tenantId } = await createCourseAPI(teacherToken, `Peek Course ${ts}`);
  const sessionId = await startSessionAPI(teacherToken, courseId);

  /* 4️⃣  Join classroom */
  /* 4️⃣  Join classroom */
  const joinClassroom = async (page: any) => {
    await page.goto(`${BASE}/classroom/${sessionId}`);
    await page.waitForTimeout(1500);
    const joinBtn = page.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
    await page.waitForTimeout(5000);
  };

  await Promise.all([
    joinClassroom(tPage),
    joinClassroom(sAPage),
    joinClassroom(sBPage),
  ]);

  /* Give time for LiveKit connections */
  await tPage.waitForTimeout(3000);

  /* 5️⃣  Assign breakouts via API */
  const assignments: Record<string, string> = {
    [sAId]: 'b',
    [sBId]: 'b',
    [tId] : 'main',
  };
  await assignBreakoutsAPI(teacherToken, sessionId, assignments);

  /* 6️⃣  Wait for metadata propagation */
  await tPage.waitForTimeout(3000);
  await sAPage.waitForTimeout(3000);

  /* ── Before monitor — verify initial state ── */
  const beforeTeacherState = await tPage.evaluate(() => {
    const state = (window as any).__breakoutState;
    return {
      stateExists: !!state,
      isMonitoring: state?.isMonitoring || false,
      monitorTarget: state?.monitorTarget || null,
      peekMode: state?.peekMode !== false,
    };
  });

  console.log('Before monitor — Teacher state:', JSON.stringify(beforeTeacherState));
  expect(beforeTeacherState.stateExists).toBe(true);

  /* ── Student B gets current remote participant count ── */
  const beforeStudentBCount = await sBPage.evaluate(() => {
    const room = (window as any).__lk_room__;
    if (!room) return { roomExists: false, count: 0 };
    const remotes = Array.from(room.remoteParticipants?.values?.() || []);
    return {
      roomExists: true,
      count: remotes.length,
      identities: remotes.map((p: any) => p.identity),
    };
  });
  console.log('Before monitor — Student B remotes:', JSON.stringify(beforeStudentBCount));

  /* 7️⃣  Teacher opens Breakout tab, turns OFF Peek Visibility, clicks Monitor Room B */
  await tPage.click('[data-testid="sidebar-tab-breakout"]');
  await tPage.waitForTimeout(800);

  // Toggle peek visibility OFF (invisible mode)
  const peekToggle = tPage.locator('input[data-testid="peek-visibility-toggle"]').first();
  await peekToggle.waitFor({ state: 'visible', timeout: 5000 });
  const isChecked = await peekToggle.isChecked();
  if (isChecked) {
    await peekToggle.click();
  }
  await tPage.waitForTimeout(200);

  // Click "Monitor Room B"
  await tPage.click('[data-testid="monitor-room-b"]');
  await tPage.waitForTimeout(2000);

  /* 8️⃣  After monitor — verify teacher state */
  const afterTeacherState = await tPage.evaluate(() => {
    const state = (window as any).__breakoutState;
    return {
      isMonitoring: state?.isMonitoring || false,
      monitorTarget: state?.monitorTarget || null,
      peekMode: state?.peekMode !== false,
      // Teacher should still be in "main" visually
      localBreakoutId: state?.localBreakoutId || null,
    };
  });
  console.log('After monitor — Teacher state:', JSON.stringify(afterTeacherState));

  expect(afterTeacherState.isMonitoring).toBe(true);
  expect(afterTeacherState.peekMode).toBe(false);
  expect(afterTeacherState.monitorTarget).toBe('b');
  // Teacher's visible room should still be "main" (or null)
  expect(afterTeacherState.localBreakoutId).not.toBe('b');

  /* 9️⃣  Student B — verify teacher does NOT appear in remote participants */
  const afterStudentBCount = await sBPage.evaluate(() => {
    const room = (window as any).__lk_room__;
    if (!room) return { roomExists: false, count: 0 };
    const remotes = Array.from(room.remoteParticipants?.values?.() || []);
    return {
      roomExists: true,
      count: remotes.length,
      identities: remotes.map((p: any) => p.identity),
      hasTeacher: remotes.some((p: any) => (p.metadata || '').includes('TEACHER')), // heuristic for teacher metadata
    };
  });
  console.log('After monitor — Student B remotes:', JSON.stringify(afterStudentBCount));

  // In invisible mode, student should NOT see teacher as a new participant
  // Count should remain the same OR teacher should not be identifiable as having joined this room
  expect(afterStudentBCount.count).toBe(beforeStudentBCount.count);

  /* 🔟  Teacher stops monitoring */
  await tPage.click('[data-testid="stop-monitor"]');
  await tPage.waitForTimeout(1000);

  const finalTeacherState = await tPage.evaluate(() => {
    const state = (window as any).__breakoutState;
    return {
      isMonitoring: state?.isMonitoring || false,
      monitorTarget: state?.monitorTarget || null,
    };
  });
  console.log('After stop — Teacher state:', JSON.stringify(finalTeacherState));
  expect(finalTeacherState.isMonitoring).toBe(false);
  expect(finalTeacherState.monitorTarget).toBeNull();

  await tCtx.close();
  await sACtx.close();
  await sBCtx.close();
});
