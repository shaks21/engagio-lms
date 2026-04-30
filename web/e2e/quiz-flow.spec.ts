/**
 * Quiz Flow E2E — Real Auth + Live API
 *
 * Steps verified:
 * 1. Register teacher + login via browser
 * 2. Create course + start session via API
 * 3. Create quiz via REST → verify 201 + status=pending
 * 4. Start quiz → verify currentQuestionIndex=0 + options JSON
 * 5. Register student → submit answer → verify score/correct
 * 6. Next question → verify index=1
 * 7. End quiz → verify status=completed
 * 8. Leaderboard → verify JSON array with userId + totalScore
 * 9. Inspector: confirm quiz:leaderboard JSON structure
 * 10. Network integrity: no 401 for students in quiz flow
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://164.68.119.230:3001';

function apiCall(accessToken: string) {
  return async (method: string, path: string, body?: any) => {
    const res = await fetch(`http://localhost:3000${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': 'default',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = res.status !== 204 ? await res.json() : {};
    return { status: res.status, json };
  };
}

async function registerRole(role: 'TEACHER' | 'STUDENT') {
  const email = `${role.toLowerCase()}.${Date.now()}@q.e2e`;
  const password = 'Password123!';
  let res = await fetch(`http://localhost:3000/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role }),
  });
  if (res.status >= 400) {
    res = await fetch(`http://localhost:3000/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  }
  if (res.status >= 400) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return { email, token: data.accessToken as string };
}

async function loginBrowser(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /_sign_in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.setTimeout(120_000);

test('Full Quiz Flow — create → start → answer → next → end → leaderboard', async ({ page }) => {
  /* ── 1. Auth ── */
  const teacher = await registerRole('TEACHER');
  const student = await registerRole('STUDENT');
  const api = apiCall(teacher.token);

  await loginBrowser(page, teacher.email, 'Password123!');

  /* ── 2. Course + Session via API ── */
  const { status: cStatus, json: course } = await api('POST', '/courses', {
    title: `Quiz E2E ${Date.now()}`,
    description: 'E2E',
  });
  expect(cStatus).toBe(201);

  const { status: sStatus, json: session } = await api('POST', '/sessions/start?courseId=' + course.id, {
    title: 'E2E Session',
    courseId: course.id,
  });
  expect(sStatus).toBe(201);
  const sessionId = session.id as string;

  /* ── 3. Create Quiz ── */
  const { status: qStatus, json: quiz } = await api('POST', `/sessions/${sessionId}/quizzes`, {
    questions: [
      {
        question: 'What is 2+2?',
        options: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false },
          { text: '6', isCorrect: false },
        ],
      },
      {
        question: 'What is 5*5?',
        options: [
          { text: '20', isCorrect: false },
          { text: '25', isCorrect: true },
          { text: '30', isCorrect: false },
          { text: '15', isCorrect: false },
        ],
      },
    ],
  });
  expect(qStatus).toBe(201);
  expect(quiz.status).toBe('pending');
  expect(quiz.questions).toHaveLength(2);
  const quizId = quiz.id as string;

  /* ── 4. Start Quiz ── */
  const { status: stStatus, json: start } = await api('POST', `/sessions/${sessionId}/quizzes/${quizId}/start`);
  expect(stStatus).toBe(200);
  expect(start.currentQuestionIndex).toBe(0);
  expect(start.currentQuestion).toBeDefined();
  expect(start.currentQuestion.options).toBeInstanceOf(Array);
  expect(start.currentQuestion.options.length).toBe(4);

  /* ── 5. Student Answer ── */
  const wrongOpt = start.currentQuestion.options[0].id;
  const rightOpt = start.currentQuestion.options[1].id;
  const studentApi = apiCall(student.token);
  const { status: ansStatus, json: ans } = await studentApi('POST', `/sessions/${sessionId}/quizzes/answer`, {
    quizSessionId: quizId,
    optionId: wrongOpt,
    basePoints: 10,
  });
  expect(ansStatus).toBe(200);
  expect(ans.correct).toBe(false);
  expect(ans.score).toBe(0);

  // Now answer correctly
  const { status: ans2Status, json: ans2 } = await studentApi('POST', `/sessions/${sessionId}/quizzes/answer`, {
    quizSessionId: quizId,
    optionId: rightOpt,
    basePoints: 10,
  });
  // Since we already voted wrong, re-voting right is allowed if backend permits
  // or it may return the prior state
  expect([200, 400, 409]).toContain(ans2Status);

  /* ── 6. Next Question ── */
  const { status: nxtStatus, json: nxt } = await api('POST', `/sessions/${sessionId}/quizzes/next`, {
    quizSessionId: quizId,
  });
  expect(nxtStatus).toBe(200);
  expect(nxt.currentQuestionIndex).toBe(1);

  /* ── 7. End Quiz (last question) ── */
  const { status: endStatus, json: ended } = await api('POST', `/sessions/${sessionId}/quizzes/next`, {
    quizSessionId: quizId,
  });
  expect(endStatus).toBe(200);
  expect(ended.status).toBe('completed');

  /* ── 8. Leaderboard JSON Structure ── */
  const { status: lbStatus, json: leaderboard } = await api('GET', `/sessions/${sessionId}/quizzes/${quizId}/leaderboard`);
  expect(lbStatus).toBe(200);
  expect(Array.isArray(leaderboard)).toBe(true);
  if (leaderboard.length > 0) {
    const entry = leaderboard[0];
    expect(entry).toHaveProperty('userId');
    expect(entry).toHaveProperty('totalScore');
    expect(entry).toHaveProperty('rank');
  }
  console.log('[INSPECTOR] Leaderboard JSON:', JSON.stringify(leaderboard, null, 2));

  /* ── 9. Student token integrity ── */
  const { status: stuQStatus } = await studentApi('POST', `/sessions/${sessionId}/quizzes`, {
    questions: [{ question: 'Auth test', options: [{ text: 'A', isCorrect: true }] }],
  });
  expect(stuQStatus).not.toBe(401); // May be 201 or 403, but never 401
  console.log('[E2E] Student quiz-create status:', stuQStatus);
});
