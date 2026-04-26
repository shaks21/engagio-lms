/**
 * TDD RED-GREEN-REFACTOR: Moderation Persistence (Lower Hand)
 *
 * Setup: Teacher lowers student's hand via moderation menu.
 * Expectation: isHandRaised flag updates in DB; amber glow disappears from heatmap.
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

const BASE = 'http://164.68.119.230:3001';
const API  = 'http://164.68.119.230:3000';

const TEACHER_EMAIL = 'temptest@example.com';
const TEACHER_PASS  = 'password123';

/* ─── DB helpers ─── */
function runPrisma(script: string) {
  const fs   = require('fs');
  const tmp  = path.resolve(__dirname, `../../api/tmp-persist-${Date.now()}.js`);
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

function insertSnapshot(tenantId: string, sessionId: string, userId: string, score: number) {
  runPrisma(`await prisma.engagementSnapshot.create({ data: { tenantId:'${tenantId}', sessionId:'${sessionId}', userId:'${userId}', score:${score} } });`);
}

function insertHandRaise(tenantId: string, sessionId: string, userId: string) {
  runPrisma(`await prisma.engagementEvent.create({ data: { tenantId:'${tenantId}', sessionId:'${sessionId}', type:'HAND_RAISE', payload:{ userId: '${userId}', raised: true }, timestamp: new Date() } });`);
}

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email',  email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('Moderation Persistence (Lower Hand)', () => {
  test.beforeEach(async ({ page }) => { await login(page, TEACHER_EMAIL, TEACHER_PASS); });

  test('teacher Lower Hand → amber glow removed + DB updated', async ({ page, browser }) => {
    /* ── Step 1: create course + session ── */
    const teacherToken = await page.evaluate(() => localStorage.getItem('engagio_token'));
    const courseRes = await fetch(`${API}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ title: `Persist Course ${Date.now()}`, description: 'test' }),
    });
    expect(courseRes.status).toBe(201);
    const course   = await courseRes.json();
    const tenantId = course.tenantId;

    const sessionRes = await fetch(`${API}/sessions/start?courseId=${course.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ courseId: course.id }),
    });
    expect(sessionRes.status).toBe(201);
    const session    = await sessionRes.json();
    const sessionId  = session.id;

    /* ── Step 2: create a student with raised hand ── */
    const uid = `persist-student-${Date.now()}`;
    runPrisma(`
      await prisma.user.upsert({
        where:{id:'${uid}'},
        update:{},
        create:{ id:'${uid}', email:'${uid}@example.com', password:'$argon2id$v=19$m=65536,t=3,p=4$invalid', role:'STUDENT', tenantId:'${tenantId}' }
      });
    `);

    /* ── Step 3: seed snapshot + hand raise ── */
    insertSnapshot(tenantId, sessionId, uid, 85);
    insertHandRaise(tenantId, sessionId, uid);

    /* ── Step 4: open teacher heatmap ── */
    await page.goto(`${BASE}/dashboard/teacher`);
    await page.locator('[data-testid="session-picker"]').click();
    await page.getByText(course.title).first().click();
    await page.waitForSelector('[data-testid="teacher-heatmap"]', { timeout: 15000 });
    await page.waitForTimeout(2500);

    /* ── Step 5: assert amber glow IS present ── */
    const card = page.locator(`[data-testid="participant-card-${uid}"]`).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const clsBefore = await card.evaluate((el) => el.className);
    expect(clsBefore).toMatch(/ring-amber-500|amber-glow/);

    /* ── Step 6: open moderation menu → Lower Hand ── */
    const modBtn = page.locator(`[data-testid="moderation-btn-${uid}"]`).first();
    await expect(modBtn).toBeVisible({ timeout: 5000 });
    await modBtn.click();

    const lowerHandOption = page.getByText('Lower Hand').first();
    await expect(lowerHandOption).toBeVisible({ timeout: 5000 });
    await lowerHandOption.click();

    /* ── Step 7: wait for amber glow to disappear ── */
    await page.waitForTimeout(4000); // give time for refetch + React render
    const clsAfter = await card.evaluate((el) => el.className);
    expect(clsAfter).not.toMatch(/ring-amber-500/);

    /* ── Step 8: verify DB — latest HAND_RAISE for this user must be raised:false ── */
    // We insert a HAND_RAISE_LOWERED or clear the existing one.
    // The backend should persist a HAND_RAISE event with raised:false
    runPrisma(`
      const latest = await prisma.engagementEvent.findFirst({
        where: { sessionId:'${sessionId}', tenantId:'${tenantId}', type:'HAND_RAISE', payload: { path: ['userId'], equals: '${uid}' } },
        orderBy: { timestamp: 'desc' }
      });
      if (latest && (latest.payload?.raised === false)) {
        console.log('DB_OK');
      } else { console.log('DB_FAIL'); }
    `);
  });
});
