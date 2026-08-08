import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  let accessToken: string;
  let refreshToken: string;

  // In-memory mocks for fast and reliable isolated E2E testing
  const mockUsers: any[] = [];
  const mockSessions: any[] = [];
  const mockRedisMap = new Map<string, string>();

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    isHealthy: jest.fn().mockResolvedValue(true),
    user: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newUser = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...data,
          status: data.status || 'PENDING_VERIFICATION',
          role: data.role || 'CUSTOMER',
          failedLoginAttempts: 0,
          lockoutUntil: null,
          lastLoginAt: null,
          lastLoginIp: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockUsers.push(newUser);
        return Promise.resolve(newUser);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockUsers.find((u) => {
          if (where.email && u.email === where.email) return true;
          if (where.phone && u.phone === where.phone) return true;
          if (where.OR) {
            return where.OR.some((cond: any) =>
              (cond.email && u.email === cond.email) || (cond.phone && u.phone === cond.phone),
            );
          }
          return false;
        });
        return Promise.resolve(found || null);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockUsers.find((u) => u.id === where.id);
        return Promise.resolve(found || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockUsers.findIndex((u) => u.id === where.id);
        if (idx !== -1) {
          mockUsers[idx] = { ...mockUsers[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockUsers[idx]);
        }
        return Promise.resolve(null);
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    authSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newSession = {
          id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          ...data,
          isRevoked: false,
          revokedAt: null,
          revokeReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSessions.push(newSession);
        return Promise.resolve(newSession);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockSessions.find((s) => s.id === where.id);
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let results = [...mockSessions];
        if (where.familyId) results = results.filter((s) => s.familyId === where.familyId);
        if (where.userId) results = results.filter((s) => s.userId === where.userId);
        if (where.isRevoked !== undefined) results = results.filter((s) => s.isRevoked === where.isRevoked);
        return Promise.resolve(results);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockSessions.findIndex((s) => s.id === where.id);
        if (idx !== -1) {
          mockSessions[idx] = { ...mockSessions[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockSessions[idx]);
        }
        return Promise.resolve(null);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        for (let i = 0; i < mockSessions.length; i++) {
          let match = true;
          if (where.id && mockSessions[i].id !== where.id) match = false;
          if (where.familyId && mockSessions[i].familyId !== where.familyId) match = false;
          if (where.userId && mockSessions[i].userId !== where.userId) match = false;
          if (where.isRevoked !== undefined && mockSessions[i].isRevoked !== where.isRevoked) match = false;

          if (match) {
            mockSessions[i] = { ...mockSessions[i], ...data, updatedAt: new Date() };
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
    },
    verificationToken: {
      create: jest.fn().mockResolvedValue({ id: 'v_1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'v_1' }),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({ id: 'pr_1' }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'pr_1' }),
    },
    securityAuditEvent: {
      create: jest.fn().mockResolvedValue({ id: 'sa_1' }),
    },
  };

  const mockRedisService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    isHealthy: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(mockRedisMap.get(key) || null)),
    set: jest.fn().mockImplementation((key: string, val: string) => {
      mockRedisMap.set(key, val);
      return Promise.resolve('OK');
    }),
    del: jest.fn().mockImplementation((key: string) => {
      const existed = mockRedisMap.has(key);
      mockRedisMap.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    exists: jest.fn().mockImplementation((key: string) => Promise.resolve(mockRedisMap.has(key) ? 1 : 0)),
    expire: jest.fn().mockResolvedValue(1),
    acquireLock: jest.fn().mockResolvedValue('lock_value'),
    releaseLock: jest.fn().mockResolvedValue(true),
    getClientOptions: jest.fn().mockReturnValue({}),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/auth/register (POST) - should register new user with CUSTOMER role', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(201);

    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(testEmail);
    expect(response.body.user.role).toBe('CUSTOMER');
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();

    accessToken = response.body.tokens.accessToken;
    refreshToken = response.body.tokens.refreshToken;
  });

  it('/api/auth/register (POST) - should prevent duplicate registration', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(409);
  });

  it('/api/auth/login (POST) - should authenticate registered user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identity: testEmail,
        password: testPassword,
      })
      .expect(200);

    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();

    accessToken = response.body.tokens.accessToken;
    refreshToken = response.body.tokens.refreshToken;
  });

  it('/api/auth/me (GET) - should return authenticated user profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(testEmail);
    expect(response.body.role).toBe('CUSTOMER');
  });

  it('/api/auth/me (GET) - should reject unauthorized requests', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
  });

  it('/api/auth/refresh (POST) - should rotate refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.refreshToken).not.toBe(refreshToken);

    refreshToken = response.body.refreshToken;
    accessToken = response.body.accessToken;
  });

  it('/api/auth/logout (POST) - should revoke session', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Submitting requests with revoked session access token should fail
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });
});
