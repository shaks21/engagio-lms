/**
 * Quiz Auto-Start E2E — Teacher clicks "Start Quiz" → Student overlay appears
 *
 * Verifies the fix: QuizPanel now emits 'quiz-start' immediately after creation,
 * so students see the QuizOverlay without a separate "Start Quiz" button click.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

/* ─── helpers ─── */

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
  if (!res.ok) throw new Error(`Auth failed for ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function loginBrowser(page: any, email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  const data = await registerOrLoginAPI(email, password, role);
  const token = data.accessToken as string;
  await page.goto(`${BASE}/login`);
  await page.evaluate((t: string) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  return token;
}

async function createCourseAndSession(teacherToken: string): Promise<string> {
  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ title: `AutoStart ${Date.now()}`, description: 'E2E' }),
  });
  if (!courseRes.ok) throw new Error(`Course create failed: ${courseRes.status}`);
  const course = await courseRes.json();

  const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
  });
  if (!sessionRes.ok) throw new Error(`Session start failed: ${sessionRes.status}`);
  const session = await sessionRes.json();
  return session.id as string;
}

function getUserId(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
  return payload.sub as string;
}

test.setTimeout(120_000);

test('Quiz Auto-Start — teacher creates quiz, student overlay opens automatically', async ({ browser }) => {
  const ts = Date.now();
  const tEmail = `teach-as-${ts}@test.io`;
  const sEmail = `stud-as-${ts}@test.io`;
  const password = 'Password123!';

  /* 1. Auth */
  const tToken = await registerOrLoginAPI(tEmail, password, 'TEACHER').then(d => d.accessToken) as string;
  const sToken = await registerOrLoginAPI(sEmail, password, 'STUDENT').then(d => d.accessToken) as string;
  const sessionId = await createCourseAndSession(tToken);

  /* 2. Browser contexts */
  const tCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const sCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const tPage = await tCtx.newPage();
  const sPage = await sCtx.newPage();

  try {
    await Promise.all([
      loginBrowser(tPage, tEmail, password, 'TEACHER'),
      loginBrowser(sPage, sEmail, password, 'STUDENT'),
    ]);

    /* 3. Join classroom */
    await tPage.goto(`${BASE}/classroom/${sessionId}`);
    await sPage.goto(`${BASE}/classroom/${sessionId}`);
    await tPage.waitForTimeout(5000);
    await sPage.waitForTimeout(5000);

    const tJoin = tPage.getByRole('button', { name: /Join Classroom/i }).first();
    if (await tJoin.isVisible().catch(() => false)) await tJoin.click();
    const sJoin = sPage.getByRole('button', { name: /Join Classroom/i }).first();
    if (await sJoin.isVisible().catch(() => false)) await sJoin.click();
    await tPage.waitForTimeout(4000);
    await sPage.waitForTimeout(4000);

    /* 4. Teacher opens Quiz tab */
    const quizTab = tPage.getByRole('button', { name: /Quiz/i });
    await expect(quizTab).toBeVisible({ timeout: 10000 });
    await quizTab.click();
    await tPage.waitForTimeout(800);

    /* 5. Teacher fills in Q1 */
    await tPage.fill('[data-testid="question-input-0"]', 'What is 2+2?');
    await tPage.fill('[data-testid="option-input-0-0"]', 'Three');
    await tPage.fill('[data-testid="option-input-0-1"]', 'Four');
    await tPage.check('[data-testid="correct-checkbox-0-1"]');

    /* 6. Teacher clicks "Start Quiz" (auto-starts after creation) */
    await tPage.getByTestId('submit-quiz-btn').first().click();

    /* 7. Wait for teacher to see active question UI */
    await expect(tPage.getByTestId('next-question-btn')).toBeVisible({ timeout: 15000 });
    console.log('✅ Teacher sees next-question-btn (quiz active)');

    /* 8. Student overlay should appear via socket broadcast */
    const studentOverlay = sPage.getByTestId('quiz-overlay');
    await expect(studentOverlay).toBeVisible({ timeout: 15000 });
    console.log('✅ Student sees quiz overlay');

    /* 9. Student sees question text */
    await expect(sPage.locator('text=What is 2+2?')).toBeVisible({ timeout: 8000 });
    console.log('✅ Student sees question text');

    /* 10. Student answers correctly */
    const correctOpt = sPage.locator('button', { hasText: /^Four$/i }).first();
    await correctOpt.click();
    await sPage.waitForTimeout(1200);

    /* 11. Student sees correct feedback */
    await expect(sPage.locator('text=Correct!')).toBeVisible({ timeout: 8000 });
    console.log('✅ Student sees Correct! feedback');

    /* 12. Teacher ends quiz */
    const endBtn = tPage.getByTestId('next-question-btn');
    await endBtn.click();
    await tPage.waitForTimeout(2000);

    /* 13. Student overlay dismissed */
    await expect(sPage.getByTestId('quiz-overlay')).not.toBeVisible({ timeout: 15000 });
    console.log('✅ Student overlay dismissed after quiz end');

    console.log('\n🎉 Quiz Auto-Start E2E PASSED');
  } finally {
    await tCtx.close();
    await sCtx.close();
  }
});
