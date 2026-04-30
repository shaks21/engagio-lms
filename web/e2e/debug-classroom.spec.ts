import { test, expect } from '@playwright/test';

const BASE = 'https://engagio.duckdns.org';
const API  = 'https://engagio.duckdns.org/api';

test('debug classroom state', async ({ browser }) => {
  const email = `dbg${Date.now()}@test.io`;
  const password = 'Password123!';

  // Register
  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role: 'TEACHER' }),
  });
  const data = await reg.json();
  const token = data.accessToken;

  // Course + session
  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: `Dbg ${Date.now()}`, description: 'E2E' }),
  });
  const course = await courseRes.json();
  const sessRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const session = await sessRes.json();

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  await page.goto(`${BASE}/classroom/${session.id}`);
  await page.waitForTimeout(8000);

  const title = await page.title();
  const html = await page.content();
  console.log('Page title:', title);
  console.log('HTML length:', html.length);

  // Check for known states
  if (html.includes('This page couldn\'t load')) {
    console.log('❌ Error page');
  } else if (html.includes('Preparing classroom')) {
    console.log('⏳ Preparing');
  } else if (html.includes('Authentication Required')) {
    console.log('🔒 Auth required');
  } else if (html.includes('Join Classroom')) {
    console.log('🎤 PreJoin screen');
  } else if (html.includes('Chat')) {
    console.log('✅ Classroom loaded (has Chat)');
  } else {
    console.log('❓ Unknown state');
  }

  await page.screenshot({ path: '/tmp/debug-classroom.png', fullPage: false });
  console.log('Screenshot: /tmp/debug-classroom.png');

  // Try to find Quiz tab
  const quizTab = page.getByRole('button', { name: /Quiz/i });
  const visible = await quizTab.isVisible().catch(() => false);
  console.log('Quiz tab visible:', visible);

  await ctx.close();
});
