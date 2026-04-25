/**
 * GREEN Phase: Poll Visibility E2E Test
 *
 * Checks that the Poll component renders in the sidebar when
 * the Polls tab is active.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://164.68.119.230:3001';

test.describe('Poll Container (GREEN)', () => {
  test('poll container should be visible in sidebar on poll tab', async ({ page }) => {
    // Navigate to classroom with a session
    await page.goto(`${BASE_URL}/classroom/test-session-id?tab=chat`);
    await page.waitForTimeout(1500);

    // Click the Polls tab
    const pollsTab = page.locator('button:has-text("Polls")');
    await pollsTab.click();
    await page.waitForTimeout(300);

    // The PollContainer component should be rendered
    const pollContainer = page.locator('[data-testid="poll-container"]');
    await expect(pollContainer).toBeVisible({ timeout: 3000 });

    // Teacher should see "Create Poll" button
    const createButton = pollContainer.locator('[data-testid="create-poll-btn"]');
    await expect(createButton).toBeVisible({ timeout: 2000 });
  });

  test('poll creation form should have 4 option inputs', async ({ page }) => {
    await page.goto(`${BASE_URL}/classroom/test-session-id?tab=chat`);
    await page.waitForTimeout(1500);

    const pollsTab = page.locator('button:has-text("Polls")');
    await pollsTab.click();
    await page.waitForTimeout(300);

    const pollContainer = page.locator('[data-testid="poll-container"]');
    const createButton = pollContainer.locator('[data-testid="create-poll-btn"]');
    await createButton.click();

    // Should render a question input and 4 option inputs
    const questionInput = pollContainer.locator('input[data-testid="poll-question"]');
    await expect(questionInput).toBeVisible();

    const optionInputs = pollContainer.locator('input[data-testid="poll-option"]');
    await expect(optionInputs).toHaveCount(4);
  });
});
