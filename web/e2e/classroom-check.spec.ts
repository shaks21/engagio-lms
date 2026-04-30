import { test, expect } from '@playwright/test';

const BASE = 'https://engagio.duckdns.org';
const API  = 'https://engagio.duckdns.org/api';

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
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  return res.json();
}

test('classroom page loads with token injection', async ({ browser }) => {
  const email = `test${Date.now()}@test.io`;
  const password = 'Password123!';

  // Register via API
  const data = await registerOrLoginAPI(email, password, 'TEACHER');
  const token = data.accessToken;

  // Create course + session
  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: `Test ${Date.now()}`, description: 'E2E' }),
  });
  const course = await courseRes.json();

  const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const session = await sessionRes.json();
  console.log('Session:', session.id);

  // Open browser with token injection
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
  console.log('Dashboard loaded, URL:', page.url());

  // Navigate to classroom
  await page.goto(`${BASE}/classroom/${session.id}`);
  await page.waitForTimeout(8000);
  console.log('Classroom URL:', page.url());

  // Screenshot
  await page.screenshot({ path: '/tmp/classroom-check.png', fullPage: false });
  console.log('Screenshot saved to /tmp/classroom-check.png');

  // Check for common error states
  const html = await page.content();
  if (html.includes("This page couldn't load")) {
    console.log('❌ Page load error detected');
  } else if (html.includes('Authenticating')) {
    console.log('⚠️ Still authenticating');
  } else if (html.includes('Authentication Required')) {
    console.log('❌ Auth required - token not recognized');
  } else if (html.includes('Loading classroom')) {
    console.log('⏳ Loading classroom (maybe token fetch slow)');
  } else {
    console.log('✅ Page appears to have loaded some content');
  }

  await ctx.close();
});
