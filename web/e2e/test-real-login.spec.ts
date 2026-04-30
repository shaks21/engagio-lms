import { test, expect } from '@playwright/test';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

test('real login flow', async ({ page }) => {
  const email = `realtest${Date.now()}@test.io`;
  const password = 'Password123!';

  // Register via API first
  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role: 'TEACHER' }),
  });
  console.log('Register status:', reg.status);

  // Now login via browser
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input#email', { timeout: 15000 });
  await page.fill('input#email', email);
  await page.fill('input#password', password);

  const btn = page.getByRole('button', { name: /Sign In/i });
  console.log('Button text before:', await btn.textContent());
  await btn.click();

  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  console.log('URL after login:', page.url());
  await page.screenshot({ path: '/tmp/dashboard-screenshot.png' });
  console.log('Screenshot saved to /tmp/dashboard-screenshot.png');
});
