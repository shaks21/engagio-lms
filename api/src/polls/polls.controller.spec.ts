import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantGuard } from '../tenancy/tenant.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class TenantMockGuard {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.tenantId = 'tenant_001';
    return true;
  }
}

class JwtMockGuard {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user_001', email: 'test@test.com', role: 'TEACHER', tenantId: 'tenant_001' };
    return true;
  }
}

describe('PollsController (GREEN)', () => {
  let app: INestApplication;
  let pollsService: {
    create: jest.Mock;
    vote: jest.Mock;
    findOne: jest.Mock;
    findActiveBySession: jest.Mock;
  };

  const S_SESS = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const S_POLL = 'pol-abc1-2345-6789-abcd-ef1234567890';

  beforeAll(async () => {
    pollsService = {
      create: jest.fn().mockResolvedValue({
        id: 'pol_abc',
        sessionId: 'sess_001',
        question: 'What is 2+2?',
        options: [
          { id: 'opt_1', text: '3', voteCount: 0 },
          { id: 'opt_2', text: '4', voteCount: 0 },
          { id: 'opt_3', text: '5', voteCount: 0 },
          { id: 'opt_4', text: '6', voteCount: 0 },
        ],
      }),
      vote: jest.fn().mockResolvedValue({
        id: 'pol_abc',
        options: [
          { id: 'opt_1', text: '3', voteCount: 1 },
          { id: 'opt_2', text: '4', voteCount: 2 },
        ],
      }),
      findOne: jest.fn().mockResolvedValue({
        id: 'pol_abc',
        question: 'What is 2+2?',
        totalVotes: 6,
        options: [
          { id: 'opt_2', text: '4', voteCount: 5 },
          { id: 'opt_1', text: '3', voteCount: 1 },
        ],
      }),
      findActiveBySession: jest.fn().mockResolvedValue([]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [
        { provide: PollsService, useValue: pollsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new JwtMockGuard())
      .overrideGuard(TenantGuard)
      .useValue(new TenantMockGuard())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /sessions/:id/polls', () => {
    it('should create a poll with 4 options', async () => {
      const response = await request(app.getHttpServer())
        .post(`/sessions/${S_SESS}/polls`)
        .send({
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        question: 'What is 2+2?',
      });
      expect(response.body.options).toHaveLength(4);
    });
  });

  describe('POST /sessions/:id/polls/:pollId/vote', () => {
    it('should record a vote', async () => {
      const response = await request(app.getHttpServer())
        .post(`/sessions/${S_SESS}/polls/${S_POLL}/vote`)
        .send({ optionId: 'opt_2', userId: 'user_001' });

      expect(response.status).toBe(200);
      expect(response.body.options).toBeDefined();
    });
  });

  describe('GET /sessions/:id/polls/:pollId', () => {
    it('should return poll results', async () => {
      const response = await request(app.getHttpServer())
        .get(`/sessions/${S_SESS}/polls/${S_POLL}`);

      expect(response.status).toBe(200);
      expect(response.body.options).toBeDefined();
    });
  });
});
