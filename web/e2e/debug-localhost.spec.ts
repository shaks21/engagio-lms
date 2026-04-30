import { test, expect } from '@playwright/test';

test('classroom on localhost', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  // Just load a simple page first
  await page.goto('http://127.0.0.1:3001/login');
  await page.waitForSelector('input#email', { timeout: 15000 });
  console.log('Login page OK');

  // Register via API (use localhost API)
  const email = `local${Date.now()}@test.io`;
  const reg = await fetch('http://127.0.0.1:3000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', role: 'TEACHER' }),
  });
  const data = await reg.json();
  const token = data.accessToken;
  console.log('Registered, token:', token.slice(0,20));

  // Inject token
  await page.evaluate((t) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);

  // Go to dashboard
  await page.goto('http://127.0.0.1:3001/dashboard');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  console.log('Dashboard OK');

  // Create course + session via API
  const courseRes = await fetch('http://127.0.0.1:3000/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: `Local ${Date.now()}`, description: 'E2E' }),
  });
  const course = await courseRes.json();
  const sessRes = await fetch(`http://127.0.0.1:3000/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const session = await sessRes.json();
  console.log('Session:', session.id);

  // Navigate to classroom
  await page.goto(`http://127.0.0.1:3001/classroom/${session.id}`);
  await page.waitForTimeout(10000);
  console.log('Classroom URL:', page.url());

  const html = await page.content();
  console.log('HTML length:', html.length);

  if (html.includes("This page couldn't load")) {
    console.log('❌ Error page');
  } else if (html.includes('Join Classroom')) {
    console.log('✅ PreJoin visible');
  } else if (html.includes('Chat')) {
    console.log('✅ Classroom loaded');
  } else {
    console.log('❓ Unknown, first 500 chars:', html.slice(0, 500));
  }

  await page.screenshot({ path: '/tmp/localhost-classroom.png' });
  console.log('Screenshot: /tmp/localhost-classroom.png');

  await ctx.close();
});
