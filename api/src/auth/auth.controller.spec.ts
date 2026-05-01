import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisTokenBlacklistService } from './redis-token-blacklist.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

class JwtMockGuard {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'user_001', email: 'user@test.com', role: 'TEACHER', tenantId: 'tenant_001' };
    req.headers = { authorization: 'Bearer valid-jwt-token-123' };
    return true;
  }
}

const blacklistMock = {
  blacklist: jest.fn().mockResolvedValue(undefined),
  isBlacklisted: jest.fn().mockResolvedValue(false),
};

const jwtMock = {
  decode: jest.fn().mockReturnValue({ jti: 'token-jti-123', exp: Math.floor(Date.now() / 1000) + 3600 }),
  signAsync: jest.fn().mockResolvedValue('mock-jwt'),
};

const authServiceMock = {
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  getProfile: jest.fn().mockResolvedValue({ id: 'user_001', email: 'user@test.com' }),
};

describe('AuthController - Logout', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: RedisTokenBlacklistService, useValue: blacklistMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new JwtMockGuard())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    blacklistMock.blacklist.mockClear();
    blacklistMock.isBlacklisted.mockClear();
    jwtMock.decode.mockClear();
  });

  describe('POST /auth/logout', () => {
    it('returns 200 and blacklists the token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-jwt-token-123');

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.message).toBe('Logged out successfully');
      expect(blacklistMock.blacklist).toHaveBeenCalled();
    });

    it('returns 401 when no authorization header is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout');

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 401 when authorization header is malformed', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'InvalidHeader');

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('returns 200 even when decode returns null (uses token fallback)', async () => {
      jwtMock.decode.mockReturnValueOnce(null);

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-jwt-token-123');

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.message).toBe('Logged out successfully');
      expect(blacklistMock.blacklist).toHaveBeenCalledWith(
        'valid-jwt-token-123',
        expect.any(Number),
      );
    });
  });
});
