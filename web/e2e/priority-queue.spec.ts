/**
 * TDD RED-GREEN-REFACTOR: Priority Queue Sorting
 *
 * Setup: Seeded tenant with teacher (temptest@example.com) and student accounts.
 *        We seed engagement snapshots + events for a single session, then
 *        verify TeacherHeatmap grid order.
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
  const tmp  = path.resolve(__dirname, `../../api/tmp-qp-${Date.now()}.js`);
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

function insertHandRaise(tenantId: string, sessionId: string, userId: string, raised: boolean) {
  runPrisma(`await prisma.engagementEvent.create({ data: { tenantId:'${tenantId}', sessionId:'${sessionId}', type:'HAND_RAISE', payload:{ userId: '${userId}', raised: ${raised} }, timestamp: new Date() } });`);
}

/* ─── Login helper ─── */
async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input#email',  email);
  await page.fill('input#password', password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('Priority Queue (Sorting)', () => {
  test.beforeEach(async ({ page }) => { await login(page, TEACHER_EMAIL, TEACHER_PASS); });

  test('grid order: C (Hand-Raised) → B (Low-Score) → A (High-Score)', async ({ page, browser }) => {
    /* ── STEP 1: create a course & session via API ── */
    const teacherToken = await page.evaluate(() => localStorage.getItem('engagio_token'));
    const courseRes = await fetch(`${API}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ title: `PQ Course ${Date.now()}`, description: 'test' }),
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
    const session = await sessionRes.json();
    const sessionId = session.id;

    /* ── STEP 2: create three student users ── */
    const uidA = `pq-a-${Date.now()}`;
    const uidB = `pq-b-${Date.now()}`;
    const uidC = `pq-c-${Date.now()}`;

    for (const u of [
      { id: uidA, email: `pq-a-${Date.now()}@example.com` },
      { id: uidB, email: `pq-b-${Date.now()}@example.com` },
      { id: uidC, email: `pq-c-${Date.now()}@example.com` },
    ]) {
      runPrisma(`
        await prisma.user.upsert({
          where:{id:'${u.id}'},
          update:{},
          create:{ id:'${u.id}', email:'${u.email}', password:'$argon2id$v=19$m=65536,t=3,p=4$invalid', role:'STUDENT', tenantId:'${tenantId}' }
        });
      `);
    }

    /* ── cleanup prior snapshots for this session ── */
    runPrisma(`await prisma.engagementSnapshot.deleteMany({ where:{ sessionId:'${sessionId}' } })`);

    /* ── STEP 3: seed engagement snapshots ── */
    insertSnapshot(tenantId, sessionId, uidA, 90); // high score
    insertSnapshot(tenantId, sessionId, uidB, 20); // low score
    insertSnapshot(tenantId, sessionId, uidC, 95); // hand-raised (handled next)

    /* ── STEP 4: seed hand-raise events ── */
    insertHandRaise(tenantId, sessionId, uidC, true);
    // A and B have no hand-raise event => isHandRaised = false

    /* ── STEP 5: open teacher dashboard & pick session ── */
    await page.goto(`${BASE}/dashboard/teacher`);
    await page.waitForSelector('[data-testid="session-picker"]', { timeout: 15000 });

    await page.locator('[data-testid="session-picker"]').click();
    await page.getByText(course.title).first().click();
    await page.waitForTimeout(2000);

    // Heatmap renders only after a session is selected
    await page.waitForSelector('[data-testid="teacher-heatmap"]', { timeout: 15000 });

    /* ── STEP 6: assert DOM order ── */
    const cards = await page.locator('[data-testid^="participant-card-"]').evaluateAll(
      (els) => els.map((el) => ({
        userId: el.getAttribute('data-testid')!.replace('participant-card-', ''),
        email: el.querySelector('p')?.textContent || '',
        handRaisedClass: el.className.includes('ring-amber-500') || el.className.includes('hand-raised'),
        score: el.getAttribute('data-score'),
      }))
    );

    expect(cards.length, `Expected 3 cards, got ${cards.length}`).toBe(3);

    // Order: Charlie (hand raised, score 95) → Bob (score 20, at risk) → Alice (score 90)
    expect(cards[0].email).toContain('pq-c-');
    expect(cards[1].email).toContain('pq-b-');
    expect(cards[2].email).toContain('pq-a-');

    // Charlie's card should have the glowing amber hand-raised class
    const charlieCard = await page.locator('[data-testid^="participant-card-"]').first();
    const cls = await charlieCard.evaluate((el) => el.className);
    expect(cls).toMatch(/ring-2|ring-amber-500|border-amber-500/);
  });
});
