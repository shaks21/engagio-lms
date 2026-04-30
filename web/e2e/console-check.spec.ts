import { test, expect } from '@playwright/test';

test('check console on classroom', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  const messages: string[] = [];
  page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => messages.push(`ERROR: ${err.message}`));

  // Register
  const email = `cons${Date.now()}@test.io`;
  const reg = await fetch('https://engagio.duckdns.org/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', role: 'TEACHER' }),
  });
  const data = await reg.json();
  const token = data.accessToken;

  // Create session
  const courseRes = await fetch('https://engagio.duckdns.org/api/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: `Cons ${Date.now()}`, description: 'E2E' }),
  });
  const course = await courseRes.json();
  const sessRes = await fetch(`https://engagio.duckdns.org/api/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const session = await sessRes.json();

  // Inject token and go
  await page.goto('https://engagio.duckdns.org/login');
  await page.evaluate((t) => {
    localStorage.setItem('engagio_token', t);
    localStorage.setItem('auth_token', t);
  }, token);
  await page.goto('https://engagio.duckdns.org/dashboard');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  await page.goto(`https://engagio.duckdns.org/classroom/${session.id}`);
  await page.waitForTimeout(8000);

  console.log('Console messages:');
  messages.forEach(m => console.log(m));

  await page.screenshot({ path: '/tmp/console-check.png' });
  await ctx.close();
});
