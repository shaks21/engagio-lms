// seed-health.js — create engagement snapshots for room-health E2E test
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '/home/shaks/engagio-lms/api/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  const [, , sessionId, ...pairs] = process.argv;
  const data = [];
  for (let i = 0; i < pairs.length; i += 2) {
    data.push({
      sessionId,
      userId: pairs[i],
      score: parseInt(pairs[i + 1], 10),
      tenantId: (await prisma.session.findFirst({ where: { id: sessionId }, select: { tenantId: true } }))?.tenantId || 'default',
      timestamp: new Date(),
    });
  }
  await prisma.engagementSnapshot.createMany({ data });
  await prisma.$disconnect();
  console.log('OK');
})();
