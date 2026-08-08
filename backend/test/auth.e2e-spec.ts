import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { INotificationProvider } from '../src/modules/auth/infrastructure/notification-provider.interface';

describe('AuthController & Security Audit (e2e)', () => {
  let app: INestApplication;
  const testEmail = `sec_audit_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const newPassword = 'NewPassword456!';

  let accessToken: string;
  let refreshToken: string;
  let capturedVerificationToken: string | null = null;
  let capturedResetToken: string | null = null;

  // In-memory mock repositories
  const mockUsers: Record<string, unknown>[] = [];
  const mockSessions: Record<string, unknown>[] = [];
  const mockVerificationTokens: Record<string, unknown>[] = [];
  const mockResetTokens: Record<string, unknown>[] = [];
  const mockRedisMap = new Map<string, string>();

  const mockNotificationProvider: INotificationProvider = {
    async sendVerificationToken(_dest: string, token: string) {
      capturedVerificationToken = token;
    },
    async sendPasswordResetToken(_dest: string, token: string) {
      capturedResetToken = token;
    },
  };

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
            return (where.OR as Array<Record<string, string>>).some((cond) =>
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
          const updated = { ...mockUsers[idx], ...data, updatedAt: new Date() };
          if (
            data.failedLoginAttempts &&
            typeof data.failedLoginAttempts === 'object' &&
            'increment' in data.failedLoginAttempts
          ) {
            const current = (mockUsers[idx].failedLoginAttempts as number) || 0;
            const inc = (data.failedLoginAttempts as { increment: number }).increment;
            updated.failedLoginAttempts = current + inc;
          }
          mockUsers[idx] = updated;
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
      create: jest.fn().mockImplementation(({ data }) => {
        const rec = {
          id: `vt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          isUsed: false,
          createdAt: new Date(),
        };
        mockVerificationTokens.push(rec);
        return Promise.resolve(rec);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockVerificationTokens.find(
          (t) => t.tokenHash === where.tokenHash && t.isUsed === where.isUsed,
        );
        return Promise.resolve(found || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockVerificationTokens.findIndex((t) => t.id === where.id);
        if (idx !== -1) {
          mockVerificationTokens[idx] = { ...mockVerificationTokens[idx], ...data };
          return Promise.resolve(mockVerificationTokens[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    passwordResetToken: {
      create: jest.fn().mockImplementation(({ data }) => {
        const rec = {
          id: `prt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          isUsed: false,
          createdAt: new Date(),
        };
        mockResetTokens.push(rec);
        return Promise.resolve(rec);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockResetTokens.find(
          (t) => t.tokenHash === where.tokenHash && t.isUsed === where.isUsed,
        );
        return Promise.resolve(found || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockResetTokens.findIndex((t) => t.id === where.id);
        if (idx !== -1) {
          mockResetTokens[idx] = { ...mockResetTokens[idx], ...data };
          return Promise.resolve(mockResetTokens[idx]);
        }
        return Promise.resolve(null);
      }),
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
      .overrideProvider('NOTIFICATION_PROVIDER')
      .useValue(mockNotificationProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
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

  // Helper to reset rate limits between test steps
  const clearRateLimit = () => {
    for (const key of Array.from(mockRedisMap.keys())) {
      if (key.startsWith('ratelimit:')) {
        mockRedisMap.delete(key);
      }
    }
  };

  beforeEach(() => {
    clearRateLimit();
  });

  // Scenario A: Register customer
  it('A. Register customer - should succeed and assign CUSTOMER role', async () => {
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

  // Scenario B: Attempt duplicate registration
  it('B. Attempt duplicate registration - should return 409 Conflict', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(409);
  });

  // Scenario C: Attempt privileged-role registration
  it('C. Attempt privileged-role registration - should reject unknown/privileged fields with 400 Bad Request', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `priv_${Date.now()}@example.com`,
        password: testPassword,
        role: 'ADMIN',
      })
      .expect(400);
  });

  // Scenario D: Login with correct credentials
  it('D. Login with correct credentials - should return tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identity: testEmail,
        password: testPassword,
      })
      .expect(200);

    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
  });

  // Scenario E: Login with incorrect credentials
  it('E. Login with incorrect credentials - should return generic 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identity: testEmail,
        password: 'WrongPassword123!',
      })
      .expect(401);

    expect(res.body.error.message).toBe('Invalid identity credentials.');
  });

  // Scenario F: Access /me without token
  it('F. Access /me without token - should return 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);
  });

  // Scenario G: Access /me with valid token
  it('G. Access /me with valid token - should return safe profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(testEmail);
    expect(response.body.role).toBe('CUSTOMER');
    expect(response.body.passwordHash).toBeUndefined();
  });

  // Scenario H: Refresh valid token
  it('H. Refresh valid token - should rotate and return new tokens', async () => {
    const oldRefresh = refreshToken;
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body.refreshToken).not.toBe(oldRefresh);

    refreshToken = response.body.refreshToken;
  });

  // Scenario I & J: Reuse old refresh token after rotation -> triggers token reuse detection & revokes session family
  it('I & J. Reuse old refresh token after rotation - should fail and revoke session family', async () => {
    const oldRefresh = refreshToken;
    const rotateRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);

    const newRefresh = rotateRes.body.refreshToken;

    // Reuse the old (now revoked) token!
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401);

    // Verify that the new token from the same family is now also revoked due to reuse detection!
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: newRefresh })
      .expect(401);
  });

  // Scenario K & L: Logout & try refresh after logout
  it('K & L. Logout & try refresh after logout - should invalidate session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identity: testEmail,
        password: testPassword,
      })
      .expect(200);

    const sessionAccessToken = loginRes.body.tokens.accessToken;
    const sessionRefreshToken = loginRes.body.tokens.refreshToken;

    // Logout
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${sessionAccessToken}`)
      .expect(200);

    // Refresh after logout should fail
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: sessionRefreshToken })
      .expect(401);
  });

  // Scenario M & N: Logout-all & try refresh from another session after logout-all
  it('M & N. Logout-all - should revoke all active sessions', async () => {
    const loginRes1 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: testEmail, password: testPassword })
      .expect(200);

    const loginRes2 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: testEmail, password: testPassword })
      .expect(200);

    // Perform logout-all from session 1
    await request(app.getHttpServer())
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${loginRes1.body.tokens.accessToken}`)
      .expect(200);

    // Refreshing session 2 should fail
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes2.body.tokens.refreshToken })
      .expect(401);
  });

  // Scenario O & P: Change password & verify old sessions revoked
  it('O & P. Change password - should update password and revoke existing sessions', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: testEmail, password: testPassword })
      .expect(200);

    const activeToken = loginRes.body.tokens.accessToken;
    const activeRefresh = loginRes.body.tokens.refreshToken;

    await request(app.getHttpServer())
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${activeToken}`)
      .send({
        currentPassword: testPassword,
        newPassword: newPassword,
      })
      .expect(200);

    // Refreshing old session should fail
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: activeRefresh })
      .expect(401);

    // Logging in with old password should fail
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: testEmail, password: testPassword })
      .expect(401);

    // Logging in with new password should succeed
    const newLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: testEmail, password: newPassword })
      .expect(200);

    accessToken = newLoginRes.body.tokens.accessToken;
  });

  // Scenario Q & R: Request password reset for unknown account & verify non-enumeration
  it('Q & R. Request password reset for unknown account - should return generic confirmation without revealing account presence', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ identity: 'nonexistent_user_999@example.com' })
      .expect(200);

    expect(response.body.message).toContain('If an account exists');
  });

  // Scenario S & T: Reset password & reuse reset token
  it('S & T. Reset password & reuse reset token - should reset password and reject reuse', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ identity: testEmail })
      .expect(200);

    expect(capturedResetToken).toBeDefined();

    // Reset password using token
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        token: capturedResetToken!,
        newPassword: testPassword,
      })
      .expect(200);

    // Reusing token should fail with 400 Bad Request
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        token: capturedResetToken!,
        newPassword: testPassword,
      })
      .expect(400);
  });

  // Scenario U & V: Verify account & reuse verification token
  it('U & V. Verify account & reuse verification token - should verify identity and reject reuse', async () => {
    expect(capturedVerificationToken).toBeDefined();

    // Verify account
    await request(app.getHttpServer())
      .post('/api/auth/verify-account')
      .send({ token: capturedVerificationToken! })
      .expect(200);

    // Reusing verification token should fail with 400 Bad Request
    await request(app.getHttpServer())
      .post('/api/auth/verify-account')
      .send({ token: capturedVerificationToken! })
      .expect(400);
  });

  // Scenario W: Trigger login brute-force protection
  it('W. Trigger login brute-force protection - should temporarily lock account after repeated failures', async () => {
    const bfEmail = `bf_user_${Date.now()}@example.com`;

    // Register user
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: bfEmail, password: testPassword })
      .expect(201);

    // Trigger 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identity: bfEmail, password: 'WrongPassword123!' });
    }

    // 6th attempt even with CORRECT password should be blocked due to account lock
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identity: bfEmail, password: testPassword })
      .expect(401);

    expect(res.body.error.message).toContain('locked');
  });

  // Scenario X: Trigger rate limit
  it('X. Trigger rate limit - should return 429 Too Many Requests when rate threshold exceeded', async () => {
    const rateLimitIdentity = `ratelimit_${Date.now()}@example.com`;

    let hitRateLimit = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({ identity: rateLimitIdentity });

      if (res.status === 429) {
        hitRateLimit = true;
        expect(res.body.error.message).toContain('Too many requests');
        break;
      }
    }

    expect(hitRateLimit).toBe(true);
  });
});
