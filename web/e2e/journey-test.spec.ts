import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

/* ─── Accounts ─── */
const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS  = 'password123';
const STUDENT_EMAIL = 'e2e_student@test.com';
const STUDENT_PASS  = 'student123';
const BASE          = 'http://164.68.119.230:3001';
const API           = 'http://164.68.119.230:3000';

/** Direct DB insert (Node child_process) so we don't wait 60 s for Kafka. */
function insertSnapshot(tenantId: string, sessionId: string, userId: string, score: number) {
  const fs = require('fs');
  const tmpFile = path.resolve(__dirname, `../../api/tmp-insert-${Date.now()}.js`);
  const script = `
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');
const { Pool }         = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
(async () => {
  await prisma.engagementSnapshot.create({
    data: { tenantId: '${tenantId}', sessionId: '${sessionId}', userId: '${userId}', score: ${score} }
  });
  await prisma.$disconnect();
})();
`;
  fs.writeFileSync(tmpFile, script);
  execSync(`cd ${path.resolve(__dirname, '../../api')} && node "${tmpFile}"`, {
    timeout: 15000,
    stdio: 'pipe',
  });
  fs.unlinkSync(tmpFile);
}

test.describe('Grand Audit – Continuous Journey (A→B→C→D)', () => {
  test('end-to-end: course → session → student join → heatmap card', async ({ browser }) => {
    /* ── Browser contexts ── */
    const teacherCtx  = await browser.newContext();
    const studentCtx  = await browser.newContext();
    const teacherPage = await teacherCtx.newPage();
    const studentPage = await studentCtx.newPage();

    /* ── Helper: login ── */
    async function login(page: any, email: string, password: string) {
      await page.goto(`${BASE}/login`);
      await page.fill('input#email',  email);
      await page.fill('input#password', password);
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForURL(/\/dashboard/);
    }

    await login(teacherPage, TEACHER_EMAIL, TEACHER_PASS);
    await login(studentPage, STUDENT_EMAIL, STUDENT_PASS);

    /* ═══════════════════════
       STEP A — CREATE COURSE
    ═══════════════════════ */
    await teacherPage.goto(`${BASE}/dashboard/courses`);
    await teacherPage.getByRole('button', { name: 'New Course' }).click();
    const courseTitle = `Journey Course ${Date.now()}`;
    await teacherPage.fill('input[placeholder*="Course title"]', courseTitle);
    await teacherPage.fill('textarea[placeholder*="description"]', 'Journey-test course');

    const createPromise = teacherPage.waitForResponse(
      (res: any) => res.url().includes('/courses') && res.request().method() === 'POST',
      { timeout: 10000 }
    );
    await teacherPage.getByRole('button', { name: 'Create' }).click();
    const createRes = await createPromise;
    expect(createRes.status()).toBe(201);

    const course   = await createRes.json();
    const courseId = course.id;
    const tenantId = course.tenantId;

    await expect(teacherPage.getByText(courseTitle).first()).toBeVisible({ timeout: 10000 });

    /* ═══════════════════════
       STEP B — START SESSION
    ═══════════════════════ */
    await teacherPage.goto(`${BASE}/dashboard/courses/${courseId}`);
    await teacherPage.getByRole('button', { name: 'Start Session' }).click();
    await teacherPage.waitForTimeout(1200);

    const teacherToken = await teacherPage.evaluate(() => localStorage.getItem('engagio_token'));
    const sessRes = await fetch(
      `${API}/sessions/history?courseId=${courseId}`,
      { headers: { Authorization: `Bearer ${teacherToken}` } }
    );
    const sessions = await sessRes.json();
    expect(sessions.length).toBeGreaterThan(0);
    const sessionId      = sessions[0].id;
    const classroomCode  = sessions[0].classroomCode || sessionId;

    /* ═══════════════════════
       STEP C — STUDENT JOINS
       We join, extract metadata, then close the context to avoid OOM.
    ═══════════════════════ */
    await studentPage.goto(`${BASE}/classroom/${sessionId}`);
    await studentPage.waitForTimeout(2000);
    const joinBtn = studentPage.getByRole('button', { name: /Join/i }).first();
    if (await joinBtn.isVisible().catch(() => false)) {
      await joinBtn.click();
    }
    await studentPage.waitForTimeout(3000);

    // Decode student userId from JWT
    const studentToken = await studentPage.evaluate(() => localStorage.getItem('engagio_token'));
    const payload      = JSON.parse(
      Buffer.from(studentToken!.split('.')[1], 'base64').toString('utf-8')
    );
    const studentId = payload.sub;

    // Free student browser memory before heavy teacher dashboard loads
    await studentCtx.close();

    /* ═══════════════════════
       STEP D — HEATMAP CARD (no seed script, direct DB insert)
    ═══════════════════════ */
    insertSnapshot(tenantId, sessionId, studentId, 75);
    await teacherPage.waitForTimeout(2000);

    await teacherPage.goto(`${BASE}/dashboard/teacher`);
    await teacherPage.waitForTimeout(1000);

    // Open session-picker dropdown and click session by title text
    await teacherPage.locator('[data-testid="session-picker"]').click();
    await teacherPage.getByText(courseTitle).first().click();

    await teacherPage.waitForTimeout(3000);

    // Student card visible in heatmap
    await expect(
      teacherPage.getByText(STUDENT_EMAIL, { exact: false }).first()
    ).toBeVisible({ timeout: 15000 });

    /* ── cleanup teacher context ── */
    await teacherCtx.close();
  });
});
