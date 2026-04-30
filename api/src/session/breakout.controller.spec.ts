import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { BreakoutController } from './breakout.controller';
import { BreakoutService } from './breakout.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../tenancy/tenant.guard';

class JwtMockGuard {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'host_001', email: 'host@test.com', role: 'TEACHER', tenantId: 'tenant_001' };
    return true;
  }
}

class TenantMockGuard {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.tenantId = 'tenant_001';
    return true;
  }
}

describe('BreakoutController (State-First Preview)', () => {
  let app: INestApplication;
  let breakoutService: typeof breakoutMock;

  const breakoutMock = {
    assignBreakouts: jest.fn(),
    listParticipants: jest.fn().mockResolvedValue(['stu1', 'stu2', 'stu3', 'stu4']),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [BreakoutController],
      providers: [
        { provide: BreakoutService, useValue: breakoutMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new JwtMockGuard())
      .overrideGuard(TenantGuard)
      .useValue(new TenantMockGuard())
      .compile();

    app = moduleRef.createNestApplication();
    breakoutService = breakoutMock;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    breakoutService.assignBreakouts.mockClear();
    breakoutService.listParticipants.mockClear();
  });

  describe('POST /sessions/:id/breakouts/preview', () => {
    it('returns local preview assignments WITHOUT touching LiveKit (RED)', async () => {
      const response = await request(app.getHttpServer())
        .post('/sessions/sess_001/breakouts/preview')
        .send({ groupCount: 2 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.assignments).toBeDefined();

      // Must NOT call assignBreakouts (the preview endpoint never persists)
      expect(breakoutService.assignBreakouts).not.toHaveBeenCalled();

      // All 4 students must be assigned to one of the 2 rooms
      const assignments = response.body.assignments;
      const keys = Object.keys(assignments);
      expect(keys).toHaveLength(4);
      // Host excluded (they stay in main)
      expect(keys).not.toContain('host_001');
    });

    it('supports empty rooms when groupCount > participants', async () => {
      breakoutService.listParticipants.mockResolvedValueOnce(['stu1']);

      const response = await request(app.getHttpServer())
        .post('/sessions/sess_002/breakouts/preview')
        .send({ groupCount: 3 });

      expect(response.status).toBe(200);
      const assignments = response.body.assignments;
      // Only one student assigned
      expect(Object.keys(assignments)).toHaveLength(1);
    });

    it('preserves room count when allowEmptyRooms is true', async () => {
      breakoutService.listParticipants.mockResolvedValueOnce(['stu1', 'stu2']);

      const response = await request(app.getHttpServer())
        .post('/sessions/sess_003/breakouts/preview')
        .send({ groupCount: 5 });

      expect(response.status).toBe(200);
      const assignments = response.body.assignments;
      // 2 students in 5 rooms still possible; assignments exist for all 2
      expect(Object.keys(assignments).length).toBe(2);
      // Room count should be capped to MAX_ROOMS but not to participant count
      expect(Object.values(assignments).every(
        (r: any) => ['room-a','room-b','room-c','room-d','room-e'].includes(r)
      )).toBe(true);
    });
  });

  describe('PATCH /sessions/:id/breakouts', () => {
    it('accepts arbitrary assignment map and triggers persist', async () => {
      breakoutService.assignBreakouts.mockResolvedValueOnce({ stu1: 'room-a', stu2: 'room-b' });

      const response = await request(app.getHttpServer())
        .patch('/sessions/sess_001/breakouts')
        .send({
          assignments: { stu1: 'room-a', stu2: 'room-b' },
          grantPermissions: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(breakoutService.assignBreakouts).toHaveBeenCalledWith(
        'tenant_001',
        'sess_001',
        'host_001',
        { stu1: 'room-a', stu2: 'room-b' },
        true,
      );
    });
  });
});
