import { PrismaClient, Role, EventType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/engagio_db',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🗑️  Clearing existing data...\n');

  // Delete in reverse dependency order
  await prisma.engagementSnapshot.deleteMany();
  await prisma.engagementEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ─── TENANT 1: Tech Academy ───
  // ───────────────────────────────
  console.log('🏫 Creating Tenant 1: Tech Academy...');

  const t1 = await prisma.tenant.create({
    data: { name: 'Tech Academy' },
  });

  // Instructors
  const teacher1 = await prisma.user.create({
    data: {
      tenantId: t1.id,
      email: 'dr.smith@techacademy.edu',
      password: '$2b$10$dummyhashfortesting1234567890123456',
      role: Role.TEACHER,
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      tenantId: t1.id,
      email: 'prof.jones@techacademy.edu',
      password: '$2b$10$dummyhashfortesting1234567890123456',
      role: Role.TEACHER,
    },
  });

  // Students (8 across both courses)
  const student1 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'alice@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student2 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'bob@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student3 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'carol@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student4 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'dave@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student5 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'emma@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student6 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'frank@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student7 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'grace@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student8 = await prisma.user.create({
    data: { tenantId: t1.id, email: 'hank@techacademy.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });

  // Courses
  const course1 = await prisma.course.create({
    data: {
      tenantId: t1.id,
      title: 'Advanced React Patterns',
      description: 'HOCs, render props, hooks, and compound components',
      instructorId: teacher1.id,
    },
  });

  const course2 = await prisma.course.create({
    data: {
      tenantId: t1.id,
      title: 'Machine Learning Fundamentals',
      description: 'Supervised learning, neural networks, and evaluation metrics',
      instructorId: teacher2.id,
    },
  });

  // Enrollments - Course 1: Alice, Bob, Carol, Dave, Emma
  for (const s of [student1, student2, student3, student4, student5]) {
    await prisma.enrollment.create({ data: { tenantId: t1.id, userId: s.id, courseId: course1.id } });
  }

  // Enrollments - Course 2: Frank, Grace, Hank, Alice, Bob (cross-enroll)
  for (const s of [student6, student7, student8, student1, student2]) {
    await prisma.enrollment.create({ data: { tenantId: t1.id, userId: s.id, courseId: course2.id } });
  }

  // ─── ACTIVE SESSION 1: Advanced React (Teacher: dr.smith) ───
  // ──────────────────────────────────────────────────────────────
  console.log('📡 Creating Active Session 1: Advanced React...');

  const now = new Date();
  const sessionStart = new Date(now.getTime() - 45 * 60 * 1000); // 45 min ago

  const session1 = await prisma.session.create({
    data: {
      tenantId: t1.id,
      courseId: course1.id,
      userId: teacher1.id,
      classroomCode: 'REACT-XK9F',
      startedAt: sessionStart,
    },
  });

  // Generate engagement events for 5 active students in session 1
  const activeStudents1 = [
    { user: student1, name: 'Alice', engagement: 'HIGH' },
    { user: student2, name: 'Bob', engagement: 'HIGH' },
    { user: student3, name: 'Carol', engagement: 'MEDIUM' },
    { user: student4, name: 'Dave', engagement: 'LOW' },
    { user: student5, name: 'Emma', engagement: 'HIGH' },
  ];

  for (const s of activeStudents1) {
    const baseScore = s.engagement === 'HIGH' ? 80 : s.engagement === 'MEDIUM' ? 55 : 30;
    const events: any[] = [];

    for (let min = 2; min <= 40; min++) {
      // Mouse movement events every ~30 seconds
      events.push({
        type: EventType.MOUSE_TRACK,
        payload: { x: Math.floor(Math.random() * 1200), y: Math.floor(Math.random() * 800) },
        timestamp: new Date(sessionStart.getTime() + min * 60000 + Math.random() * 30000),
      });

      // Keystrokes for high/medium engagement
      if (s.engagement === 'HIGH' && min % 2 === 0) {
        events.push({
          type: EventType.KEYSTROKE,
          payload: { count: Math.floor(Math.random() * 10 + 5) },
          timestamp: new Date(sessionStart.getTime() + min * 60000),
        });
      }

      // Chat events for engaged students
      if (s.name === 'Alice' && min % 10 === 0) {
        events.push({
          type: EventType.CHAT,
          payload: { message: 'Great explanation!' },
          timestamp: new Date(sessionStart.getTime() + min * 60000 + 5000),
        });
      }
      if (s.name === 'Emma' && min === 25) {
        events.push({
          type: EventType.CHAT,
          payload: { message: 'Can you repeat the compound component example?' },
          timestamp: new Date(sessionStart.getTime() + 25 * 60000),
        });
      }

      // Blur events for low engagement (Dave) — no FOCUS type exists, use JOIN instead as re-focus marker
      if (s.name === 'Dave' && min % 5 === 0) {
        events.push({
          type: EventType.BLUR,
          payload: { duration: Math.floor(Math.random() * 120)},
          timestamp: new Date(sessionStart.getTime() + min * 60000 + 10000),
        });
      }

      // Mic/screen share occasionally for high engagement
      if (s.name === 'Bob' && min === 15) {
        events.push({
          type: EventType.MIC,
          payload: { action: 'toggle', enabled: true },
          timestamp: new Date(sessionStart.getTime() + 15 * 60000),
        });
      }
    }

    // Insert all events
    await prisma.engagementEvent.createMany({
      data: events.map(e => ({
        tenantId: t1.id,
        sessionId: session1.id,
        type: e.type,
        payload: e.payload,
        timestamp: e.timestamp,
      })),
    });

    // Generate engagement snapshots every 60 seconds
    for (let snapshotMin = 1; snapshotMin <= 40; snapshotMin++) {
      // Score varies over time: HIGH students stay 70-95, MEDIUM 40-65, LOW 10-40
      const variance = Math.floor(Math.random() * 20 - 10);
      const score = Math.max(0, Math.min(100, baseScore + variance));
      await prisma.engagementSnapshot.create({
        data: {
          tenantId: t1.id,
          sessionId: session1.id,
          userId: s.user.id,
          score,
          timestamp: new Date(sessionStart.getTime() + snapshotMin * 60000),
        },
      });
    }

    // Print per-student stats
    const totalEvents = events.length;
    console.log(`   ${s.name}: ${totalEvents} events, ~${baseScore}% avg engagement`);
  }

  // ─── COMPLETED SESSION: Advanced React (Yesterday) ───
  // ──────────────────────────────────────────────────────
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const session1old = await prisma.session.create({
    data: {
      tenantId: t1.id,
      courseId: course1.id,
      userId: teacher1.id,
      classroomCode: 'REACT-YESTERDAY',
      startedAt: yesterday,
      endedAt: new Date(yesterday.getTime() + 60 * 60 * 1000),
      dwellTime: 3600,
    },
  });

  // Historical snapshots for yesterday's session
  for (const s of activeStudents1) {
    const base = s.engagement === 'HIGH' ? 85 : s.engagement === 'MEDIUM' ? 50 : 25;
    for (let m = 1; m <= 50; m++) {
      await prisma.engagementSnapshot.create({
        data: {
          tenantId: t1.id,
          sessionId: session1old.id,
          userId: s.user.id,
          score: Math.max(0, Math.min(100, base + Math.floor(Math.random() * 15 - 7))),
          timestamp: new Date(yesterday.getTime() + m * 60000),
        },
      });
    }
  }

  // ─── ACTIVE SESSION 2: Machine Learning (Teacher: prof.jones) ───
  // ─────────────────────────────────────────────────────────────────
  console.log('\n📡 Creating Active Session 2: Machine Learning...');

  const sessionStart2 = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

  const session2 = await prisma.session.create({
    data: {
      tenantId: t1.id,
      courseId: course2.id,
      userId: teacher2.id,
      classroomCode: 'ML-TR7C',
      startedAt: sessionStart2,
    },
  });

  const activeStudents2 = [
    { user: student6, name: 'Frank', engagement: 'HIGH' },
    { user: student7, name: 'Grace', engagement: 'MEDIUM' },
    { user: student8, name: 'Hank', engagement: 'HIGH' },
    { user: student1, name: 'Alice', engagement: 'LOW' },
    { user: student2, name: 'Bob', engagement: 'MEDIUM' },
  ];

  for (const s of activeStudents2) {
    const baseScore = s.engagement === 'HIGH' ? 85 : s.engagement === 'MEDIUM' ? 50 : 25;
    const events: any[] = [];

    for (let min = 2; min <= 28; min++) {
      events.push({
        type: EventType.MOUSE_TRACK,
        payload: { x: Math.floor(Math.random() * 1200), y: Math.floor(Math.random() * 800) },
        timestamp: new Date(sessionStart2.getTime() + min * 60000 + Math.random() * 30000),
      });

      if (s.engagement === 'HIGH' && min % 3 === 0) {
        events.push({
          type: EventType.KEYSTROKE,
          payload: { count: Math.floor(Math.random() * 8 + 3) },
          timestamp: new Date(sessionStart2.getTime() + min * 60000),
        });
      }

      if (s.name === 'Frank' && min === 20) {
        events.push({
          type: EventType.SCREEN_SHARE,
          payload: { action: 'start' },
          timestamp: new Date(sessionStart2.getTime() + 20 * 60000),
        });
      }

      if (s.name === 'Hank' && min === 10) {
        events.push({
          type: EventType.CHAT,
          payload: { message: 'What is the learning rate?' },
          timestamp: new Date(sessionStart2.getTime() + 10 * 60000),
        });
      }

      if (s.name === 'Alice' && min % 6 === 0) {
        events.push({
          type: EventType.BLUR,
          payload: { duration: 60 + Math.floor(Math.random() * 90) },
          timestamp: new Date(sessionStart2.getTime() + min * 60000),
        });
      }
    }

    await prisma.engagementEvent.createMany({
      data: events.map(e => ({
        tenantId: t1.id,
        sessionId: session2.id,
        type: e.type,
        payload: e.payload,
        timestamp: e.timestamp,
      })),
    });

    for (let snapshotMin = 1; snapshotMin <= 28; snapshotMin++) {
      const score = Math.max(0, Math.min(100, baseScore + Math.floor(Math.random() * 15 - 7)));
      await prisma.engagementSnapshot.create({
        data: {
          tenantId: t1.id,
          sessionId: session2.id,
          userId: s.user.id,
          score,
          timestamp: new Date(sessionStart2.getTime() + snapshotMin * 60000),
        },
      });
    }

    console.log(`   ${s.name}: ${events.length} events, ~${baseScore}% avg engagement`);
  }

  // ─── TENANT 2: Design Institute ───
  // ──────────────────────────────────
  console.log('\n🏫 Creating Tenant 2: Design Institute...');

  const t2 = await prisma.tenant.create({ data: { name: 'Design Institute' } });

  const teacher3 = await prisma.user.create({
    data: {
      tenantId: t2.id,
      email: 'maria@designinst.edu',
      password: '$2b$10$dummyhashfortesting1234567890123456',
      role: Role.TEACHER,
    },
  });

  const student9 = await prisma.user.create({
    data: { tenantId: t2.id, email: 'ivy@designinst.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });
  const student10 = await prisma.user.create({
    data: { tenantId: t2.id, email: 'jack@designinst.edu', password: '$2b$10$dummyhash1234567890123456', role: Role.STUDENT },
  });

  const course3 = await prisma.course.create({
    data: {
      tenantId: t2.id,
      title: 'UI/UX Design Principles',
      description: 'User research, wireframing, prototyping, usability testing',
      instructorId: teacher3.id,
    },
  });

  await prisma.enrollment.create({
    data: { tenantId: t2.id, userId: student9.id, courseId: course3.id },
  });
  await prisma.enrollment.create({
    data: { tenantId: t2.id, userId: student10.id, courseId: course3.id },
  });

  console.log('\n✅ Seed complete! Summary:');
  console.log(`   Tenants: 2 (Tech Academy, Design Institute)`);
  console.log(`   Teachers: 3 (dr.smith, prof.jones, maria)`);
  console.log(`   Students: 10 (alice—jack)`);
  console.log(`   Courses: 3 (React, ML, UI/UX)`);
  console.log(`   Active Sessions: 2 (REACT-XK9F, ML-TR7C)`);
  console.log(`   Historical Sessions: 1`);
  console.log(`\n🔑 Login credentials (password: any value, this is mock data):`);
  console.log(`   dr.smith@techacademy.edu  (Teacher, Tenant 1)`);
  console.log(`   prof.jones@techacademy.edu (Teacher, Tenant 1)`);
  console.log(`   alice@techacademy.edu     (Student, Tenant 1)`);
  console.log(`   maria@designinst.edu      (Teacher, Tenant 2)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
