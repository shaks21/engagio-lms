import { test, expect } from '@playwright/test';

test('can reach local frontend', async ({ page }) => {
  // Try localhost first
  await page.goto('http://127.0.0.1:3001/login');
  await page.waitForSelector('input#email', { timeout: 15000 });
  console.log('✅ 127.0.0.1 works');
  await page.screenshot({ path: '/tmp/localhost-login.png' });
});

test('can reach external IP frontend', async ({ page }) => {
  await page.goto('http://164.68.119.230:3001/login');
  await page.waitForSelector('input#email', { timeout: 15000 });
  console.log('✅ external IP works');
  await page.screenshot({ path: '/tmp/external-login.png' });
});
