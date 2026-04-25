import { test, expect } from '@playwright/test';

const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS = 'password123';
const BASE = 'http://164.68.119.230:3001';

/**
 * RED PHASE: This test MUST FAIL right now because the backend CreateCourseDto
 * requires instructorId (@IsUUID()), but the frontend only sends { title, description }.
 * Expected initial failure: page.waitForResponse catches 400 Bad Request.
 */
test.describe('Course Creation (TDD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input#email', TEACHER_EMAIL);
    await page.fill('input#password', TEACHER_PASS);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('teacher fills form and sees new course', async ({ page }) => {
    // Directly navigate to courses page
    await page.goto(`${BASE}/dashboard/courses`);

    // Wait for the New Course button to be clickable
    await page.getByRole('button', { name: 'New Course' }).click();

    // Fill form
    const testTitle = `Audit Course ${Date.now()}`;
    await page.fill('input[placeholder*="Course title"]', testTitle);
    await page.fill('textarea[placeholder*="description"]', 'A course created by the audit test.');

    // Submit and capture response
    const createPromise = page.waitForResponse(
      res => res.url().includes('/courses') && res.request().method() === 'POST',
      { timeout: 10000 }
    );
    await page.getByRole('button', { name: 'Create' }).click();

    const res = await createPromise;

    // After fix: expect 201; before fix: this line catches 400/422
    expect(res.status()).toBe(201);

    // Wait for the grid to refresh and show the new course
    await expect(page.getByText(testTitle, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });
});
