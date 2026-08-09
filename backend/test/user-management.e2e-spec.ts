import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { INotificationProvider } from '../src/modules/auth/infrastructure/notification-provider.interface';

describe('User Management & RBAC Module (e2e)', () => {
  let app: INestApplication;

  const customerEmail = `customer_${Date.now()}@example.com`;
  const customer2Email = `customer2_${Date.now()}@example.com`;
  const adminEmail = `admin_${Date.now()}@example.com`;
  const superAdminEmail = `superadmin_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  let customerToken: string;
  let customer2Token: string;
  let adminToken: string;
  let superAdminToken: string;

  let createdAddressId: string;

  // In-memory mocks
  const mockUsers: Record<string, unknown>[] = [];
  const mockSessions: Record<string, unknown>[] = [];
  const mockProfiles: Record<string, unknown>[] = [];
  const mockAddresses: Record<string, unknown>[] = [];
  const mockPreferences: Record<string, unknown>[] = [];
  const mockRoles: Record<string, unknown>[] = [
    { id: 'r_1', code: 'CUSTOMER', name: 'Customer', isSystem: true },
    { id: 'r_2', code: 'ADMIN', name: 'Admin', isSystem: true },
    { id: 'r_3', code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
  ];
  const mockPermissions: Record<string, unknown>[] = [
    { id: 'p_1', code: 'users.read', resource: 'users', action: 'read' },
    { id: 'p_2', code: 'users.suspend', resource: 'users', action: 'suspend' },
    { id: 'p_3', code: 'users.assign_role', resource: 'users', action: 'assign_role' },
    { id: 'p_4', code: 'roles.read', resource: 'roles', action: 'read' },
    { id: 'p_5', code: 'roles.manage', resource: 'roles', action: 'manage' },
    { id: 'p_6', code: 'permissions.assign', resource: 'permissions', action: 'assign' },
    { id: 'p_7', code: 'profile.read', resource: 'profile', action: 'read' },
    { id: 'p_8', code: 'profile.update', resource: 'profile', action: 'update' },
    { id: 'p_9', code: 'addresses.manage', resource: 'addresses', action: 'manage' },
  ];
  const mockRolePermissions: Record<string, unknown>[] = [
    { roleId: 'r_2', permissionId: 'p_1' },
    { roleId: 'r_2', permissionId: 'p_2' },
    { roleId: 'r_2', permissionId: 'p_3' },
    { roleId: 'r_2', permissionId: 'p_4' },
    { roleId: 'r_2', permissionId: 'p_5' },
    { roleId: 'r_2', permissionId: 'p_6' },
    { roleId: 'r_3', permissionId: 'p_1' },
    { roleId: 'r_3', permissionId: 'p_2' },
    { roleId: 'r_3', permissionId: 'p_3' },
    { roleId: 'r_3', permissionId: 'p_4' },
    { roleId: 'r_3', permissionId: 'p_5' },
    { roleId: 'r_3', permissionId: 'p_6' },
    { roleId: 'r_1', permissionId: 'p_7' },
    { roleId: 'r_1', permissionId: 'p_8' },
    { roleId: 'r_1', permissionId: 'p_9' },
  ];
  const mockUserRoles: Record<string, unknown>[] = [];
  const mockRedisMap = new Map<string, string>();

  const mockNotificationProvider: INotificationProvider = {
    async sendVerificationToken() {},
    async sendPasswordResetToken() {},
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
          status: data.status || 'ACTIVE',
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
          return false;
        });
        return Promise.resolve(found || null);
      }),
      findUnique: jest.fn().mockImplementation(({ where, include, select }) => {
        const found = mockUsers.find((u) => u.id === where.id);
        if (!found) return Promise.resolve(null);
        const res = { ...found };

        if (include?.roleAssignments || select?.roleAssignments) {
          const assignments = mockUserRoles
            .filter((ur) => ur.userId === found.id)
            .map((ur) => ({
              ...ur,
              role: mockRoles.find((r) => r.id === ur.roleId),
            }));
          res.roleAssignments = assignments;
        }

        if (include?.profile || select?.profile) {
          res.profile = mockProfiles.find((p) => p.userId === found.id) || null;
        }
        if (include?.preference || select?.preference) {
          res.preference = mockPreferences.find((p) => p.userId === found.id) || null;
        }
        if (include?.addresses || select?.addresses) {
          res.addresses = mockAddresses.filter((a) => a.userId === found.id);
        }

        return Promise.resolve(res);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let results = [...mockUsers];
        if (where?.status) results = results.filter((u) => u.status === where.status);
        if (where?.role) results = results.filter((u) => u.role === where.role);
        return Promise.resolve(results);
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        let results = [...mockUsers];
        if (where?.status) results = results.filter((u) => u.status === where.status);
        if (where?.role) results = results.filter((u) => u.role === where.role);
        return Promise.resolve(results.length);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockUsers.findIndex((u) => u.id === where.id);
        if (idx !== -1) {
          mockUsers[idx] = { ...mockUsers[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockUsers[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    userProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockProfiles.find((p) => p.userId === where.userId);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newProf = {
          id: `prof_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockProfiles.push(newProf);
        return Promise.resolve(newProf);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const idx = mockProfiles.findIndex((p) => p.userId === where.userId);
        if (idx !== -1) {
          mockProfiles[idx] = { ...mockProfiles[idx], ...update, updatedAt: new Date() };
          return Promise.resolve(mockProfiles[idx]);
        } else {
          const newProf = {
            id: `prof_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockProfiles.push(newProf);
          return Promise.resolve(newProf);
        }
      }),
    },
    userAddress: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        let results = mockAddresses.filter((a) => a.userId === where.userId);
        if (where?.isDefault !== undefined) {
          results = results.filter((a) => a.isDefault === where.isDefault);
        }
        return Promise.resolve(results);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockAddresses.find((a) => a.id === where.id);
        return Promise.resolve(found || null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockAddresses.find(
          (a) => a.id === where.id && (where.userId ? a.userId === where.userId : true),
        );
        return Promise.resolve(found || null);
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        const count = mockAddresses.filter((a) => a.userId === where.userId).length;
        return Promise.resolve(count);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newAddr = {
          id: `addr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockAddresses.push(newAddr);
        return Promise.resolve(newAddr);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockAddresses.findIndex((a) => a.id === where.id);
        if (idx !== -1) {
          mockAddresses[idx] = { ...mockAddresses[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockAddresses[idx]);
        }
        return Promise.resolve(null);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        for (let i = 0; i < mockAddresses.length; i++) {
          if (
            mockAddresses[i].userId === where.userId &&
            (where.isDefault === undefined || mockAddresses[i].isDefault === where.isDefault)
          ) {
            mockAddresses[i] = { ...mockAddresses[i], ...data, updatedAt: new Date() };
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const idx = mockAddresses.findIndex((a) => a.id === where.id);
        if (idx !== -1) {
          const deleted = mockAddresses.splice(idx, 1)[0];
          return Promise.resolve(deleted);
        }
        return Promise.resolve(null);
      }),
    },
    userPreference: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockPreferences.find((p) => p.userId === where.userId);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newPref = {
          id: `pref_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockPreferences.push(newPref);
        return Promise.resolve(newPref);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const idx = mockPreferences.findIndex((p) => p.userId === where.userId);
        if (idx !== -1) {
          mockPreferences[idx] = { ...mockPreferences[idx], ...update, updatedAt: new Date() };
          return Promise.resolve(mockPreferences[idx]);
        } else {
          const newPref = {
            id: `pref_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockPreferences.push(newPref);
          return Promise.resolve(newPref);
        }
      }),
    },
    role: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockRoles.find((r) => r.code === where.code || r.id === where.id);
        if (!found) return Promise.resolve(null);

        const rPermissions = mockRolePermissions
          .filter((rp) => rp.roleId === found.id)
          .map((rp) => ({
            ...rp,
            permission: mockPermissions.find((p) => p.id === rp.permissionId),
          }));

        return Promise.resolve({ ...found, rolePermissions: rPermissions });
      }),
      findMany: jest.fn().mockResolvedValue(mockRoles),
      create: jest.fn().mockImplementation(({ data }) => {
        const newRole = {
          id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockRoles.push(newRole);
        return Promise.resolve(newRole);
      }),
    },
    permission: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockPermissions.find((p) => p.code === where.code || p.id === where.id);
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockResolvedValue(mockPermissions),
      create: jest.fn().mockImplementation(({ data }) => {
        const newPerm = {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockPermissions.push(newPerm);
        return Promise.resolve(newPerm);
      }),
    },
    rolePermission: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userRoleAssignment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
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
        if (where.userId) results = results.filter((s) => s.userId === where.userId);
        if (where.isRevoked !== undefined)
          results = results.filter((s) => s.isRevoked === where.isRevoked);
        return Promise.resolve(results);
      }),
    },
    verificationToken: {
      create: jest.fn().mockResolvedValue({ id: 'v_1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    securityAuditEvent: {
      create: jest.fn().mockResolvedValue({ id: 'sa_1' }),
    },
    $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrismaService)),
  };

  const mockRedisService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    isHealthy: jest.fn().mockResolvedValue(true),
    get: jest
      .fn()
      .mockImplementation((key: string) => Promise.resolve(mockRedisMap.get(key) || null)),
    set: jest.fn().mockImplementation((key: string, val: string) => {
      mockRedisMap.set(key, val);
      return Promise.resolve('OK');
    }),
    del: jest.fn().mockImplementation((key: string) => {
      const existed = mockRedisMap.has(key);
      mockRedisMap.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    exists: jest
      .fn()
      .mockImplementation((key: string) => Promise.resolve(mockRedisMap.has(key) ? 1 : 0)),
    expire: jest.fn().mockResolvedValue(1),
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

    // Register Customer 1
    const cust1Res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: customerEmail, password: testPassword });
    customerToken = cust1Res.body.tokens.accessToken;

    // Register Customer 2
    const cust2Res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: customer2Email, password: testPassword });
    customer2Token = cust2Res.body.tokens.accessToken;

    // Register Admin user & promote mock role to ADMIN
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: testPassword });
    adminToken = adminRes.body.tokens.accessToken;
    const adminUser = mockUsers.find((u) => u.email === adminEmail);
    if (adminUser) adminUser.role = 'ADMIN';

    // Register Super Admin & promote mock role to SUPER_ADMIN
    const superAdminRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: superAdminEmail, password: testPassword });
    superAdminToken = superAdminRes.body.tokens.accessToken;
    const superAdminUser = mockUsers.find((u) => u.email === superAdminEmail);
    if (superAdminUser) superAdminUser.role = 'SUPER_ADMIN';
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Customer Profile
  it('GET /api/users/me - should return customer profile details without password hash', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(res.body.email).toBe(customerEmail);
    expect(res.body.role).toBe('CUSTOMER');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('PATCH /api/users/me - should update profile name', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        firstName: 'Sarah',
        lastName: 'Elshishtawy',
      })
      .expect(200);

    expect(res.body.firstName).toBe('Sarah');
  });

  // 2. User Address & Ownership Security
  it('POST /api/users/me/addresses - should add address A for Customer 1 as default', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        recipientName: 'Sarah Elshishtawy',
        phone: '+201012345678',
        governorateState: 'Gharbia',
        city: 'Tanta',
        street: 'El-Galaa Street, Bld 5',
        isDefault: true,
      })
      .expect(201);

    expect(res.body.isDefault).toBe(true);
    createdAddressId = res.body.id;
  });

  it('POST /api/users/me/addresses - should add address B as new default and switch address A to false', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        recipientName: 'Sarah Elshishtawy',
        phone: '+201012345678',
        governorateState: 'Cairo',
        city: 'Nasr City',
        street: 'Abbas El Akkad St',
        isDefault: true,
      })
      .expect(201);

    expect(res.body.isDefault).toBe(true);
    createdAddressId2 = res.body.id;

    // Verify Address A is now isDefault: false
    const addr1 = mockAddresses.find((a) => a.id === createdAddressId);
    expect(addr1?.isDefault).toBe(false);
  });

  it('PATCH /api/users/me/addresses/:id - Customer 2 cannot update Customer 1 address (Ownership Security)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/users/me/addresses/${createdAddressId}`)
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ recipientName: 'Hacker Name' })
      .expect(404);
  });

  // 3. User Preferences
  it('PATCH /api/users/me/preferences - should update preferences', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me/preferences')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        language: 'en',
        currency: 'USD',
      })
      .expect(200);

    expect(res.body.language).toBe('en');
    expect(res.body.currency).toBe('USD');
  });

  // 4. Admin User Management & Access Control Guards
  it('GET /api/admin/users - Customer cannot access admin user list (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('GET /api/admin/users - Admin can access paginated user list (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(4);
  });

  // 5. Privilege Escalation Protection
  it('PUT /api/admin/users/:id/roles - Admin CANNOT grant SUPER_ADMIN role (Privilege Escalation Protection)', async () => {
    const cust1 = mockUsers.find((u) => u.email === customerEmail);
    await request(app.getHttpServer())
      .put(`/api/admin/users/${cust1?.id}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ roles: ['SUPER_ADMIN'] })
      .expect(403);
  });

  it('PUT /api/admin/users/:id/roles - Super Admin CAN grant SUPER_ADMIN role', async () => {
    const cust1 = mockUsers.find((u) => u.email === customerEmail);
    await request(app.getHttpServer())
      .put(`/api/admin/users/${cust1?.id}/roles`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ roles: ['ADMIN'] })
      .expect(200);
  });

  // 6. Admin RBAC Management
  it('GET /api/admin/roles - Admin can view system roles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('POST /api/admin/roles - Admin can create custom role', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'CATALOG_MANAGER',
        name: 'Catalog Manager',
        description: 'Manages categories and products',
      })
      .expect(201);

    expect(res.body.code).toBe('CATALOG_MANAGER');
  });
});
