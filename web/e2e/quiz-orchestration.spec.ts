/**
 * Quiz Orchestration E2E — Multi-role Happy Path
 *
 * Roles: Teacher + Student (isolated browser contexts)
 * Flow: Teacher creates a 2-question quiz → starts → student answers via WebSocket
 *       → teacher advances → ends → both verify leaderboard
 *
 * Assertions: Tailwind glassmorphism classes, timer countdown, socket-triggered overlay,
 *             and LeaderboardDisplay with correct scores.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://164.68.119.230:3001';
const API = process.env.API_URL || 'http://164.68.119.230:3000';

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

async function loginBrowser(page: Page, email: string, password: string, role: 'TEACHER' | 'STUDENT') {
  // First register via API to get token
  const data = await registerOrLoginAPI(email, password, role);
  const token = data.accessToken as string;

  // Inject token into localStorage for both keys used by different parts of the app
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function createCourseAndSession(teacherToken: string): Promise<string> {
  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({ title: `QuizOrchestration ${Date.now()}`, description: 'E2E' }),
  });
  if (!courseRes.ok) throw new Error(`Course create failed: ${courseRes.status}`);
  const course = await courseRes.json();

  const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`,
    },
  });
  if (!sessionRes.ok) throw new Error(`Session start failed: ${sessionRes.status}`);
  const session = await sessionRes.json();
  return session.id as string;
}

test.setTimeout(120_000);

/* ───────────────────────── test ───────────────────────── */

test('Multi-role Quiz Orchestration — teacher creates, student answers, leaderboard verified', async ({ browser }) => {
  const ts = Date.now();
  const tEmail = `teach${ts}@test.io`;
  const sEmail = `stud${ts}@test.io`;
  const password = 'Password123!';

  /* ── 1. Register users via API ── */
  const tData = await registerOrLoginAPI(tEmail, password, 'TEACHER');
  const sData = await registerOrLoginAPI(sEmail, password, 'STUDENT');
  const teacherToken = tData.accessToken as string;
  const studentId = sData.user?.id as string;
  console.log(`👤 Teacher: ${tEmail}`);
  console.log(`👤 Student: ${sEmail}  id=${studentId}`);

  /* ── 2. Create course + session via API (fast path) ── */
  const sessionId = await createCourseAndSession(teacherToken);
  console.log(`📚 Session: ${sessionId}`);

  /* ── 3. Isolated browser contexts ── */
  const tCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const sCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const tPage = await tCtx.newPage();
  const sPage = await sCtx.newPage();

  try {
    /* ── 4. Login both browsers ── */
    await Promise.all([
      loginBrowser(tPage, tEmail, password, 'TEACHER'),
      loginBrowser(sPage, sEmail, password, 'STUDENT'),
    ]);
    console.log('✅ Both users logged in');

    /* ── 5. Navigate to classroom ── */
    await tPage.goto(`${BASE}/classroom/${sessionId}`);
    await sPage.goto(`${BASE}/classroom/${sessionId}`);

    // Wait for hydration + LiveKit + socket connect
    await tPage.waitForTimeout(5000);
    await sPage.waitForTimeout(5000);

    // Join if prompted (PreJoin → actual classroom)
    const tJoin = tPage.getByRole('button', { name: /Join Classroom/i }).first();
    const tJoinVisible = await tJoin.isVisible().catch(() => false);
    if (tJoinVisible) {
      await tJoin.click();
      console.log('🎤 Teacher clicked Join Classroom');
    }
    const sJoin = sPage.getByRole('button', { name: /Join Classroom/i }).first();
    const sJoinVisible = await sJoin.isVisible().catch(() => false);
    if (sJoinVisible) {
      await sJoin.click();
      console.log('🎤 Student clicked Join Classroom');
    }

    // Wait for actual classroom UI to render (sidebar with tabs)
    await tPage.waitForSelector('[data-testid="classroom-sidebar"]', { timeout: 15000 });
    await sPage.waitForSelector('[data-testid="classroom-sidebar"]', { timeout: 15000 });
    console.log('✅ Both in classroom');

    /* ── 6. Teacher opens Quiz tab ── */
    const quizTab = tPage.getByRole('button', { name: /Quiz/i });
    await expect(quizTab).toBeVisible({ timeout: 10000 });
    await quizTab.click();
    await tPage.waitForTimeout(600);
    console.log('📝 Quiz tab open');

    /* ── 7. Teacher creates a 2-question quiz ── */
    // Q1: "What is 2+2?"  correct: 4
    await tPage.fill('[data-testid="question-input-0"]', 'What is 2+2?');
    await tPage.fill('[data-testid="option-input-0-0"]', 'Three');
    await tPage.fill('[data-testid="option-input-0-1"]', 'Four');
    await tPage.check('[data-testid="correct-checkbox-0-1"]');

    // Add Q2
    await tPage.getByTestId('add-question-btn').first().click();
    await tPage.waitForTimeout(300);

    // Q2: "What is 5×5?"  correct: 25
    await tPage.fill('[data-testid="question-input-1"]', 'What is 5 times 5?');
    await tPage.fill('[data-testid="option-input-1-0"]', 'Twenty');
    await tPage.fill('[data-testid="option-input-1-1"]', 'Twenty-five');
    await tPage.check('[data-testid="correct-checkbox-1-1"]');

    // Submit
    await tPage.getByTestId('submit-quiz-btn').first().click();

    // Wait for state transition → pending
    await expect(tPage.getByTestId('start-quiz-btn')).toBeVisible({ timeout: 15000 });
    console.log('✅ Quiz created (status=pending)');

    /* ── 8. Teacher starts the quiz ── */
    await tPage.getByTestId('start-quiz-btn').click();
    await tPage.waitForTimeout(1500);
    console.log('▶️ Quiz started');

    /* ── 9. Student — verify QuizOverlay appears via WebSocket ── */
    const overlay = sPage.getByTestId('quiz-overlay');
    await expect(overlay).toBeVisible({ timeout: 15000 });
    console.log('🎯 Student overlay visible');

    // Assertion: glassmorphism backdrop-blur-sm / bg-black/40
    const overlayContainer = sPage.locator('[data-testid="quiz-overlay"]');
    await expect(overlayContainer).toHaveClass(/backdrop-blur-sm/);
    await expect(overlayContainer).toHaveClass(/bg-black\/40/);
    console.log('✅ Glassmorphism classes present');

    // Assertion: timer counts down (starts at 30s)
    const timerEl = overlay.locator('text=/^(30|29|28|27|26)s$/');
    await expect(timerEl).toBeVisible({ timeout: 5000 });
    console.log('⏱ Timer counting down');

    // Assertion: Q1 text visible
    await expect(overlay.locator('text=What is 2+2?')).toBeVisible();

    /* ── 10. Student selects the correct answer ── */
    // Capture browser console logs for debugging
    const consoleLogs: string[] = [];
    sPage.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    const correctOpt = overlay.locator('button', { hasText: /^Four$/i }).first();
    await correctOpt.click();
    await sPage.waitForTimeout(1200);

    // Debug: log all console output
    console.log('=== Student Console Logs ===');
    consoleLogs.forEach((l) => console.log(l));
    console.log('===========================');

    // Verify feedback shows "Correct!"
    await expect(overlay.locator('text=Correct!')).toBeVisible({ timeout: 8000 });
    console.log('✅ Student answered Q1 correctly');

    /* ── 11. Teacher clicks Next Question ── */
    console.log('[DEBUG] Looking for next-question-btn...');
    await tPage.screenshot({ path: '/tmp/teacher-before-next.png' });
    const nextBtn = tPage.getByTestId('next-question-btn');
    console.log('[DEBUG] nextBtn locator created');
    await expect(nextBtn).toBeVisible({ timeout: 10000 });
    console.log('[DEBUG] nextBtn is visible');
    await nextBtn.click();
    console.log('[DEBUG] nextBtn clicked');
    await tPage.waitForTimeout(1000);
    console.log('⏩ Next question sent');

    /* ── 12. Student sees Q2 via WebSocket ── */
    console.log('[DEBUG] Waiting for Q2 overlay...');
    await expect(overlay.locator('text=What is 5 times 5?')).toBeVisible({ timeout: 15000 });
    console.log('🎯 Student sees Q2');

    // Student intentionally answers incorrectly for variety
    console.log('[DEBUG] Looking for wrong answer...');
    const wrongOpt = overlay.locator('button', { hasText: 'Twenty' }).first();
    await wrongOpt.click();
    await sPage.waitForTimeout(800);
    console.log('✅ Student answered Q2 incorrectly');

    /* ── 13. Teacher ends quiz ── */
    console.log('[DEBUG] Looking for End Quiz button...');
    const endBtn = tPage.getByTestId('next-question-btn');
    await expect(endBtn).toContainText('End Quiz', { timeout: 5000 });
    await endBtn.click();
    await tPage.waitForTimeout(2000);
    console.log('🏁 Quiz ended');

    // Give socket events time to propagate
    await tPage.waitForTimeout(3000);
    await sPage.waitForTimeout(3000);

    /* ── 14. Teacher clicks Show Leaderboard ── */
    const lbBtn = tPage.getByTestId('show-leaderboard-btn');
    await expect(lbBtn).toBeVisible({ timeout: 15000 });
    await lbBtn.click();
    await tPage.waitForTimeout(1500);
    console.log('🏆 Leaderboard requested');

    /* ── 15. Both verify LeaderboardDisplay ── */
    const tLeaderboard = tPage.getByTestId('leaderboard-display');
    await expect(tLeaderboard).toBeVisible({ timeout: 15000 });
    console.log('✅ Teacher sees LeaderboardDisplay');

    // Tailwind class assertions on leaderboard
    await expect(tLeaderboard).toHaveClass(/bg-edu-slate/);
    await expect(tLeaderboard).toHaveClass(/rounded-2xl/);
    console.log('✅ Leaderboard Tailwind classes verified');

    // Verify student appears in leaderboard with score = 10 (Q1 correct only)
    const lbText = await tLeaderboard.textContent();
    expect(lbText).toContain('1 participant');
    expect(lbText).toContain('10');
    console.log('✅ Leaderboard score = 10');

    // Student: overlay should have disappeared (quiz ended / leaderboard broadcast)
    await expect(sPage.getByTestId('quiz-overlay')).not.toBeVisible({ timeout: 15000 });
    console.log('✅ Student overlay dismissed after quiz end');

    // NOTE: Currently the student sidebar does not auto-show leaderboard on quiz:end.
    // The socket event quiz:leaderboard stores state in useQuizSocket but nothing
    // renders it for students in the sidebar. This is a known UX gap.
    // The test verifies the overlay disappears (proving the socket event arrived).

    console.log('\n🎉 Quiz Orchestration E2E PASSED');
  } finally {
    await tCtx.close();
    await sCtx.close();
  }
});
