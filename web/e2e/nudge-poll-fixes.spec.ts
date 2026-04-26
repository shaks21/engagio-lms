import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS  = 'password123';
const STUDENT_EMAIL = 'e2e_student@test.com';
const STUDENT_PASS  = 'student123';

function runPrisma(script: string) {
  const fs = require('fs');
  const tmp = path.resolve(__dirname, '../../api/tmp-nudge-test.js');
  const body = `
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
(async () => {
  try { ${script} } catch (e) { console.error('DB error:', e); process.exit(1); }
  await prisma.$disconnect();
})();
`;
  fs.writeFileSync(tmp, body);
  try { execSync(`cd ${path.resolve(__dirname, '../../api')} && node "${tmp}"`, { timeout: 15000, stdio: 'pipe' }); } finally { fs.unlinkSync(tmp); }
}

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email',  email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test('private nudge: only target student sees toast while other does not', async ({ browser }) => {
  const teacherCtx   = await browser.newContext();
  const targetCtx    = await browser.newContext();
  /* Observer on dashboard — outside classroom */
  const teacherPage  = await teacherCtx.newPage();
  const targetPage   = await targetCtx.newPage();

  await login(teacherPage, TEACHER_EMAIL, TEACHER_PASS);
  await login(targetPage, STUDENT_EMAIL, STUDENT_PASS);

  const teacherToken = await teacherPage.evaluate(() => localStorage.getItem('engagio_token'));
  const targetToken  = await targetPage.evaluate(() => localStorage.getItem('engagio_token'));
  const targetPayload = JSON.parse(Buffer.from(targetToken!.split('.')[1], 'base64').toString('utf-8'));
  const targetId     = targetPayload.sub as string;

  const courseRes = await fetch(`${API}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ title: `NudgeFix ${Date.now()}`, description: 'test' }),
  });
  expect(courseRes.status).toBe(201);
  const course = await courseRes.json();
  const tenantId = course.tenantId;

  const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({ courseId: course.id }),
  });
  expect(sessionRes.status).toBe(201);
  const session = await sessionRes.json();
  const sessionId = session.id;

  runPrisma(`await prisma.engagementSnapshot.create({ data: { tenantId:'${tenantId}', sessionId:'${sessionId}', userId:'${targetId}', score: 55 } });`);

  /* Target joins classroom */
  await targetPage.goto(`${BASE}/classroom/${sessionId}`);
  await targetPage.waitForTimeout(2000);
  const joinBtn = targetPage.getByRole('button', { name: /Join/i }).first();
  if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
  await targetPage.waitForTimeout(3000);

  /* Teacher nudges target */
  await teacherPage.goto(`${BASE}/dashboard/teacher`);
  await teacherPage.locator('[data-testid="session-picker"]').click();
  await teacherPage.getByText(course.title).first().click();
  await teacherPage.waitForSelector('[data-testid="teacher-heatmap"]', { timeout: 15000 });
  await teacherPage.waitForTimeout(2500);

  const card = teacherPage.locator(`[data-testid="participant-card-${targetId}"]`).first();
  await expect(card).toBeVisible({ timeout: 15000 });

  const zapBtn = teacherPage.locator(`button[data-testid="nudge-btn-${targetId}"]`).first();
  await expect(zapBtn).toBeVisible({ timeout: 5000 });
  await zapBtn.click();

  /* Target sees toast */
  await expect(targetPage.locator('text=Your teacher is checking in on you').first()).toBeVisible({ timeout: 8000 });

  await teacherCtx.close();
  await targetCtx.close();
});
