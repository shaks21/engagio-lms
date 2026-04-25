// Ghost Class: Seed Engagement Data for Heatmap E2E Test
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const HASHED_PASSWORD = '$2b$10$weyK/EGeDVoXqkyHgo95aORsGA5whlxlY3m.2zAcE8YKwh6OQmsIO'; // bcrypt('password123', 10)

const SESSION_SCORES = [20, 25, 38, 45, 52, 60, 75, 82, 91, 95];

async function main() {
  console.log('🔍 Querying existing data...');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error('No tenant found. Run the app seed first or create a tenant.');
  }
  console.log(`✓ Tenant: ${tenant.id} (${tenant.name})`);

  const teacher = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'TEACHER' },
  });
  const ghostTeacher = teacher || (await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'ghost.teacher@engagio.test',
      password: HASHED_PASSWORD,
      role: 'TEACHER',
    },
  }));
  console.log(`✓ Teacher: ${ghostTeacher.email}`);

  const course = await prisma.course.findFirst({
    where: { tenantId: tenant.id },
  });
  const ghostCourse = course || (await prisma.course.create({
    data: {
      tenantId: tenant.id,
      title: 'Ghost Course — Heatmap Stress Test',
      description: 'Auto-generated for heatmap E2E verification',
      instructorId: ghostTeacher.id,
    },
  }));
  console.log(`✓ Course: ${ghostCourse.id} (${ghostCourse.title})`);

  const existingSession = await prisma.session.findFirst({
    where: { tenantId: tenant.id, endedAt: null },
  });

  let session;
  if (existingSession) {
    session = existingSession;
    console.log(`✓ Reusing active session: ${session.id}`);
  } else {
    session = await prisma.session.create({
      data: {
        tenantId: tenant.id,
        courseId: ghostCourse.id,
        userId: ghostTeacher.id,
        classroomCode: `GHOST-${Date.now()}`,
      },
    });
    console.log(`✓ Created new session: ${session.id}`);
  }

  const students: any[] = [];
  for (let i = 0; i < SESSION_SCORES.length; i++) {
    const email = `ghost.student.${i + 1}@engagio.test`;
    let student = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (!student) {
      student = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          password: HASHED_PASSWORD,
          role: 'STUDENT',
        },
      });
    }
    students.push(student);

    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { tenantId: tenant.id, userId: student.id, courseId: ghostCourse.id },
    });
    if (!existingEnrollment) {
      await prisma.enrollment.create({
        data: {
          tenantId: tenant.id,
          userId: student.id,
          courseId: ghostCourse.id,
          status: 'active',
        },
      });
    }
  }
  console.log(`✓ ${students.length} ghost students ready`);

  await prisma.engagementSnapshot.deleteMany({
    where: { sessionId: session.id },
  });

  for (let i = 0; i < SESSION_SCORES.length; i++) {
    const score = SESSION_SCORES[i];
    await prisma.engagementSnapshot.create({
      data: {
        tenantId: tenant.id,
        sessionId: session.id,
        userId: students[i].id,
        score,
        timestamp: new Date(),
      },
    });
    const color = score > 70 ? 'GREEN' : score >= 40 ? 'YELLOW' : 'RED';
    console.log(`   student-${i + 1} (${students[i].email}) → score=${score} [${color}]`);
  }
  console.log(`✓ ${SESSION_SCORES.length} engagement snapshots inserted`);

  const liveScores = await prisma.engagementSnapshot.findMany({
    where: { sessionId: session.id },
    orderBy: { timestamp: 'desc' },
    select: { userId: true, score: true },
  });
  const seen = new Map();
  for (const snap of liveScores) {
    if (!seen.has(snap.userId)) seen.set(snap.userId, snap);
  }

  console.log('\n📊 Live Scores for /api/analytics/session/' + session.id + '/live-scores');
  console.log(JSON.stringify([...seen.values()], null, 2));

  console.log('\n📝 Ghost Class Summary');
  console.log(`   Session ID: ${session.id}`);
  console.log(`   Tenant ID:  ${tenant.id}`);
  console.log(`   Course ID:  ${ghostCourse.id}`);
  console.log(`   Students:   ${students.length}`);
  console.log(`   Scores:     ${SESSION_SCORES.join(', ')}`);
  console.log(`   Expected:   3 RED (<40), 3 YELLOW (40-70), 4 GREEN (>70)`);
  console.log('\n✅ Seed complete. Ready for E2E heatmap test.\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
