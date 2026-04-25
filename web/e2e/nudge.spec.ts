/**
 * TDD RED-GREEN-REFACTOR: Private Nudge via Socket.io
 *
 * Setup: Teacher and Student each open a context.
 * Teacher joins the classroom (socket connected) and navigates to the heatmap.
 * Teacher clicks Zap on the student's card.
 * Student, inside the classroom page, must see a toast.
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS  = 'password123';
const STUDENT_EMAIL = 'e2e_student@test.com';
const STUDENT_PASS  = 'student123';

/* ─── DB helpers (same as journey-test) ─── */
function runPrisma(script: string) {
  const fs   = require('fs');
  const tmp  = path.resolve(__dirname, `../../api/tmp-nudge-${Date.now()}.js`);
  const body = `
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');
const { Pool }           = require('pg');
require('dotenv').config();
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });
(async () => {
  try {
    ${script}
  } catch (e) { console.error('DB error:', e); process.exit(1); }
  await prisma.$disconnect();
})();
`;
  fs.writeFileSync(tmp, body);
  try {
    execSync(`cd ${path.resolve(__dirname, '../../api')} && node "${tmp}"`, { timeout: 15000, stdio: 'pipe' });
  } finally { fs.unlinkSync(tmp); }
}

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email',  email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('Private Nudge (Socket.io)', () => {
  test('teacher clicks Zap → student sees toast notification', async ({ browser }) => {
    /* ── Contexts ── */
    const teacherCtx  = await browser.newContext();
    const studentCtx  = await browser.newContext();
    const teacherPage = await teacherCtx.newPage();
    const studentPage = await studentCtx.newPage();

    await login(teacherPage, TEACHER_EMAIL, TEACHER_PASS);
    await login(studentPage, STUDENT_EMAIL, STUDENT_PASS);

    /* ── Step 1: Teacher creates course + starts session ── */
    const teacherToken = await teacherPage.evaluate(() => localStorage.getItem('engagio_token'));

    const courseRes = await fetch(`${API}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ title: `Nudge Course ${Date.now()}`, description: 'test' }),
    });
    expect(courseRes.status).toBe(201);
    const course    = await courseRes.json();
    const tenantId  = course.tenantId;

    const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ courseId: course.id }),
    });
    expect(sessionRes.status).toBe(201);
    const session   = await sessionRes.json();
    const sessionId = session.id;

    /* ── Step 2: Seed a snapshot for the student so they appear in heatmap ── */
    const studentToken = await studentPage.evaluate(() => localStorage.getItem('engagio_token'));
    const payload    = JSON.parse(Buffer.from(studentToken!.split('.')[1], 'base64').toString('utf-8'));
    const studentId  = payload.sub as string;

    runPrisma(`await prisma.engagementSnapshot.create({ data: { tenantId:'${tenantId}', sessionId:'${sessionId}', userId:'${studentId}', score: 45 } });`);

    /* ── Step 3: Student joins classroom ── */
    await studentPage.goto(`${BASE}/classroom/${sessionId}`);
    await studentPage.waitForTimeout(2000);
    const joinBtn = studentPage.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) {
      await joinBtn.click();
    }
    await studentPage.waitForTimeout(3000); // allow socket connect + joinClassroom round-trip

    /* ── Step 4: Teacher opens heatmap ── */
    await teacherPage.goto(`${BASE}/dashboard/teacher`);

    await teacherPage.locator('[data-testid="session-picker"]').click();
    await teacherPage.getByText(course.title).first().click();
    await teacherPage.waitForSelector('[data-testid="teacher-heatmap"]', { timeout: 15000 });
    await teacherPage.waitForTimeout(2500);

    // Ensure student card is visible
    const studentCard = teacherPage.locator(`[data-testid="participant-card-${studentId}"]`).first();
    await expect(studentCard).toBeVisible({ timeout: 15000 });

    /* ── Step 5: Teacher clicks Zap ── */
    const zap = teacherPage.locator(`[data-testid="nudge-btn-${studentId}"]`).first();
    await expect(zap).toBeVisible({ timeout: 5000 });
    await zap.click();

    /* ── Step 6: Student sees toast ── */
    // Wait for the toast to appear on the student page
    const toast = studentPage.locator('text=Your teacher is checking in on you').first();
    await expect(toast).toBeVisible({ timeout: 8000 });
    await expect(toast).toContainText('checking in');

    /* ── Clean up ── */
    await studentCtx.close();
    await teacherCtx.close();
  });
});
