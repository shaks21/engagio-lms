import { test, expect } from '@playwright/test';

test('basic login page load', async ({ page }) => {
  await page.goto('http://164.68.119.230:3001/login');
  await page.waitForSelector('input#email', { timeout: 15000 });
  await page.screenshot({ path: '/tmp/login-screenshot.png' });
  console.log('Screenshot saved to /tmp/login-screenshot.png');
});
