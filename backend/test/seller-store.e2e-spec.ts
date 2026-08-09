import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { INotificationProvider } from '../src/modules/auth/infrastructure/notification-provider.interface';

describe('Seller & Store Domain Module (e2e)', () => {
  let app: INestApplication;

  const customer1Email = `cust1_${Date.now()}@example.com`;
  const customer2Email = `cust2_${Date.now()}@example.com`;
  const adminEmail = `admin_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  let customer1Token: string;
  let customer2Token: string;
  let adminToken: string;

  let seller1AppId: string;
  let seller1Id: string;
  let seller1UserId: string;
  let seller2UserId: string;

  let store1Id: string;
  const store1Slug = `lotus-store-${Date.now()}`;

  // In-memory mocks
  const mockUsers: Record<string, unknown>[] = [];
  const mockSessions: Record<string, unknown>[] = [];
  const mockApplications: Record<string, unknown>[] = [];
  const mockSellers: Record<string, unknown>[] = [];
  const mockDocuments: Record<string, unknown>[] = [];
  const mockStores: Record<string, unknown>[] = [];
  const mockStaff: Record<string, unknown>[] = [];
  const mockAuditEvents: Record<string, unknown>[] = [];
  const mockUserRoles: Record<string, unknown>[] = [];

  const mockRoles: Record<string, unknown>[] = [
    { id: 'r_1', code: 'CUSTOMER', name: 'Customer', isSystem: true },
    { id: 'r_2', code: 'SELLER', name: 'Seller', isSystem: true },
    { id: 'r_3', code: 'ADMIN', name: 'Admin', isSystem: true },
    { id: 'r_4', code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
  ];

  const mockPermissions: Record<string, unknown>[] = [
    { id: 'p_1', code: 'sellers.read', resource: 'sellers', action: 'read' },
    { id: 'p_2', code: 'sellers.approve', resource: 'sellers', action: 'approve' },
    { id: 'p_3', code: 'sellers.reject', resource: 'sellers', action: 'reject' },
    { id: 'p_4', code: 'sellers.suspend', resource: 'sellers', action: 'suspend' },
    { id: 'p_5', code: 'sellers.activate', resource: 'sellers', action: 'activate' },
    { id: 'p_6', code: 'stores.read', resource: 'stores', action: 'read' },
    { id: 'p_7', code: 'stores.approve', resource: 'stores', action: 'approve' },
    { id: 'p_8', code: 'stores.suspend', resource: 'stores', action: 'suspend' },
    { id: 'p_9', code: 'seller_documents.read', resource: 'seller_documents', action: 'read' },
    { id: 'p_10', code: 'seller_documents.review', resource: 'seller_documents', action: 'review' },
  ];

  const mockRolePermissions: Record<string, unknown>[] = [
    { roleId: 'r_3', permissionId: 'p_1' },
    { roleId: 'r_3', permissionId: 'p_2' },
    { roleId: 'r_3', permissionId: 'p_3' },
    { roleId: 'r_3', permissionId: 'p_4' },
    { roleId: 'r_3', permissionId: 'p_5' },
    { roleId: 'r_3', permissionId: 'p_6' },
    { roleId: 'r_3', permissionId: 'p_7' },
    { roleId: 'r_3', permissionId: 'p_8' },
    { roleId: 'r_3', permissionId: 'p_9' },
    { roleId: 'r_3', permissionId: 'p_10' },
  ];

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
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
        const found = mockUsers.find(
          (u: Record<string, unknown>) => u.email === where?.email || u.phone === where?.phone,
        );
        return Promise.resolve(found || null);
      }),
      findUnique: jest.fn().mockImplementation(({ where, include, select }) => {
        const found = mockUsers.find((u: Record<string, unknown>) => u.id === where.id);
        if (!found) return Promise.resolve(null);
        const res: Record<string, unknown> = { ...found };

        if (include?.roleAssignments || select?.roleAssignments) {
          res.roleAssignments = mockUserRoles
            .filter((ur: Record<string, unknown>) => ur.userId === found.id)
            .map((ur: Record<string, unknown>) => ({
              ...ur,
              role: mockRoles.find((r: Record<string, unknown>) => r.id === ur.roleId),
            }));
        }
        return Promise.resolve(res);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockUsers)),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockUsers.findIndex((u: Record<string, unknown>) => u.id === where.id);
        if (idx !== -1) {
          mockUsers[idx] = { ...mockUsers[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockUsers[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    seller: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockSellers.find(
          (s: Record<string, unknown>) => s.id === where?.id || s.userId === where?.userId,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let results = [...mockSellers];
        if (where?.status)
          results = results.filter((s: Record<string, unknown>) => s.status === where.status);
        return Promise.resolve(results);
      }),
      count: jest.fn().mockImplementation(() => Promise.resolve(mockSellers.length)),
      create: jest.fn().mockImplementation(({ data }) => {
        const newSeller = {
          id: `sel_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          status: data.status || 'PENDING',
          verificationStatus: data.verificationStatus || 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSellers.push(newSeller);
        return Promise.resolve(newSeller);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockSellers.findIndex((s: Record<string, unknown>) => s.id === where.id);
        if (idx !== -1) {
          mockSellers[idx] = { ...mockSellers[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockSellers[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    sellerApplication: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockApplications.find((a: Record<string, unknown>) => a.id === where.id);
        return Promise.resolve(found || null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockApplications.find(
          (a: Record<string, unknown>) => a.userId === where.userId,
        );
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newApp = {
          id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          user: undefined,
          userId: data.user?.connect?.id || data.userId,
          status: data.status || 'SUBMITTED',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockApplications.push(newApp);
        return Promise.resolve(newApp);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockApplications.findIndex((a: Record<string, unknown>) => a.id === where.id);
        if (idx !== -1) {
          mockApplications[idx] = { ...mockApplications[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockApplications[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    sellerDocument: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockDocuments.find((d: Record<string, unknown>) => d.id === where.id);
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDocuments.filter((d: Record<string, unknown>) => d.sellerId === where.sellerId),
        );
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newDoc = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          seller: undefined,
          sellerId: data.seller?.connect?.id || data.sellerId,
          status: data.status || 'PENDING',
          uploadedAt: new Date(),
        };
        mockDocuments.push(newDoc);
        return Promise.resolve(newDoc);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockDocuments.findIndex((d: Record<string, unknown>) => d.id === where.id);
        if (idx !== -1) {
          mockDocuments[idx] = { ...mockDocuments[idx], ...data };
          return Promise.resolve(mockDocuments[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    store: {
      findUnique: jest.fn().mockImplementation(({ where, include }) => {
        const found = mockStores.find(
          (s: Record<string, unknown>) => s.id === where?.id || s.slug === where?.slug,
        );
        if (!found) return Promise.resolve(null);
        const res: Record<string, unknown> = { ...found };
        if (include?.seller) {
          res.seller =
            mockSellers.find((sel: Record<string, unknown>) => sel.id === found.sellerId) || null;
        }
        return Promise.resolve(res);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockStores.find(
          (s: Record<string, unknown>) => s.sellerId === where?.sellerId,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockStores)),
      count: jest.fn().mockImplementation(() => Promise.resolve(mockStores.length)),
      create: jest.fn().mockImplementation(({ data }) => {
        const newStore = {
          id: `str_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          seller: undefined,
          sellerId: data.seller?.connect?.id || data.sellerId,
          status: data.status || 'DRAFT',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStores.push(newStore);
        return Promise.resolve(newStore);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockStores.findIndex((s: Record<string, unknown>) => s.id === where.id);
        if (idx !== -1) {
          mockStores[idx] = { ...mockStores[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockStores[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    sellerStaff: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.sellerId_userId) {
          const found = mockStaff.find(
            (st: Record<string, unknown>) =>
              st.sellerId === where.sellerId_userId.sellerId &&
              st.userId === where.sellerId_userId.userId,
          );
          return Promise.resolve(found || null);
        }
        const found = mockStaff.find((st: Record<string, unknown>) => st.id === where.id);
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockStaff.filter((st: Record<string, unknown>) => st.sellerId === where.sellerId),
        );
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newStf = {
          id: `stf_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          ...data,
          seller: undefined,
          user: undefined,
          sellerId: data.seller?.connect?.id || data.sellerId,
          userId: data.user?.connect?.id || data.userId,
          status: data.status || 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStaff.push(newStf);
        return Promise.resolve(newStf);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockStaff.findIndex((st: Record<string, unknown>) => st.id === where.id);
        if (idx !== -1) {
          mockStaff[idx] = { ...mockStaff[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockStaff[idx]);
        }
        return Promise.resolve(null);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const idx = mockStaff.findIndex((st: Record<string, unknown>) => st.id === where.id);
        if (idx !== -1) {
          const deleted = mockStaff.splice(idx, 1)[0];
          return Promise.resolve(deleted);
        }
        return Promise.resolve(null);
      }),
    },
    role: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockRoles.find(
          (r: Record<string, unknown>) => r.code === where.code || r.id === where.id,
        );
        if (!found) return Promise.resolve(null);
        const rPermissions = mockRolePermissions
          .filter((rp: Record<string, unknown>) => rp.roleId === found.id)
          .map((rp: Record<string, unknown>) => ({
            ...rp,
            permission: mockPermissions.find(
              (p: Record<string, unknown>) => p.id === rp.permissionId,
            ),
          }));
        return Promise.resolve({ ...found, rolePermissions: rPermissions });
      }),
      findMany: jest.fn().mockResolvedValue(mockRoles),
    },
    permission: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockPermissions.find(
          (p: Record<string, unknown>) => p.code === where.code || p.id === where.id,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockResolvedValue(mockPermissions),
    },
    rolePermission: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userRoleAssignment: {
      deleteMany: jest.fn().mockImplementation(({ where }) => {
        let count = 0;
        for (let i = mockUserRoles.length - 1; i >= 0; i--) {
          if (mockUserRoles[i].userId === where.userId) {
            mockUserRoles.splice(i, 1);
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
      createMany: jest.fn().mockImplementation(({ data }) => {
        for (const item of data) {
          mockUserRoles.push(item);
        }
        return Promise.resolve({ count: data.length });
      }),
    },
    authSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newSession = {
          id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          isRevoked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSessions.push(newSession);
        return Promise.resolve(newSession);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockSessions.find((s: Record<string, unknown>) => s.id === where.id) || null,
        );
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockSessions.filter((s: Record<string, unknown>) => s.userId === where.userId),
        );
      }),
    },
    verificationToken: {
      create: jest.fn().mockResolvedValue({ id: 'v_1' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    securityAuditEvent: {
      create: jest.fn().mockImplementation(({ data }) => {
        const event = { id: `sa_${Date.now()}`, ...data, createdAt: new Date() };
        mockAuditEvents.push(event);
        return Promise.resolve(event);
      }),
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
      .send({ email: customer1Email, password: testPassword });
    customer1Token = cust1Res.body.tokens.accessToken;
    const c1 = mockUsers.find((u: Record<string, unknown>) => u.email === customer1Email);
    if (c1) seller1UserId = c1.id as string;

    // Register Customer 2
    const cust2Res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: customer2Email, password: testPassword });
    customer2Token = cust2Res.body.tokens.accessToken;
    const c2 = mockUsers.find((u: Record<string, unknown>) => u.email === customer2Email);
    if (c2) seller2UserId = c2.id as string;

    // Register Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: testPassword });
    adminToken = adminRes.body.tokens.accessToken;
    const adminUser = mockUsers.find((u: Record<string, unknown>) => u.email === adminEmail);
    if (adminUser) {
      adminUser.role = 'ADMIN';
      mockUserRoles.push({ userId: adminUser.id, roleId: 'r_3' });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // 1 & 2. Customer applies for Seller onboarding (cannot directly create ACTIVE seller)
  it('POST /api/sellers/apply - Customer 1 applies for seller onboarding', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sellers/apply')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        businessName: 'Lotus Fashion',
        contactPhone: '+201012345678',
        contactEmail: customer1Email,
        notes: 'Handmade dresses & cosmetics',
      })
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.businessName).toBe('Lotus Fashion');
    seller1AppId = res.body.id;
  });

  // 3. Duplicate seller application rejected
  it('POST /api/sellers/apply - Duplicate seller application rejected (409 Conflict)', async () => {
    await request(app.getHttpServer())
      .post('/api/sellers/apply')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        businessName: 'Duplicate Lotus',
        contactPhone: '+201012345678',
        contactEmail: customer1Email,
      })
      .expect(409);
  });

  // 4. Admin views seller application list
  it('GET /api/admin/sellers - Admin can view seller list (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/sellers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
  });

  // 5 & 6. Admin approves seller application (atomic Seller creation & RBAC role assignment)
  it('POST /api/admin/sellers/:id/approve - Admin approves seller application', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/sellers/${seller1AppId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.status).toBe('APPROVED');

    // Verify Seller entity was created
    const createdSeller = mockSellers.find(
      (s: Record<string, unknown>) => s.userId === seller1UserId,
    );
    expect(createdSeller).toBeDefined();
    if (createdSeller) seller1Id = createdSeller.id as string;

    // Verify user role was upgraded to SELLER in mockUserRoles
    const assignedRole = mockUserRoles.find(
      (ur: Record<string, unknown>) => ur.userId === seller1UserId,
    );
    expect(assignedRole?.roleId).toBe('r_2');
  });

  // 7 & 8. Seller creates store in DRAFT status (cannot directly activate)
  it('POST /api/sellers/me/store - Seller 1 creates store in DRAFT status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sellers/me/store')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        name: 'Lotus Gift Store',
        slug: store1Slug,
        contactEmail: customer1Email,
        contactPhone: '+201012345678',
        governorateState: 'Cairo',
        city: 'Nasr City',
      })
      .expect(201);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.slug).toBe(store1Slug);
    store1Id = res.body.id;
  });

  // 10 & 11. DRAFT store is not publicly visible
  it('GET /api/stores/:slug - DRAFT store is NOT publicly visible (404 Not Found)', async () => {
    await request(app.getHttpServer()).get(`/api/stores/${store1Slug}`).expect(404);
  });

  // Submit store for review
  it('POST /api/sellers/me/store/submit - Seller submits store for admin review', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sellers/me/store/submit')
      .set('Authorization', `Bearer ${customer1Token}`)
      .expect(201);

    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  // 9. Admin approves store
  it('POST /api/admin/stores/:id/approve - Admin approves store', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/stores/${store1Id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.status).toBe('ACTIVE');
  });

  // 10. ACTIVE store is publicly visible
  it('GET /api/stores/:slug - ACTIVE store is publicly visible (200 OK)', async () => {
    const res = await request(app.getHttpServer()).get(`/api/stores/${store1Slug}`).expect(200);

    expect(res.body.name).toBe('Lotus Gift Store');
    expect(res.body.slug).toBe(store1Slug);
  });

  // 12. Ownership Security: Customer 2 (or Seller 2) cannot access/modify Seller 1 store
  it('PATCH /api/sellers/me/store - Customer 2 cannot modify Seller 1 store (404 Not Found)', async () => {
    await request(app.getHttpServer())
      .patch('/api/sellers/me/store')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({ name: 'Hacked Store Name' })
      .expect(404);
  });

  // 15. Seller can add staff
  it('POST /api/sellers/me/staff - Seller 1 adds Customer 2 as staff member', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sellers/me/staff')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        targetUserId: seller2UserId,
        role: 'CATALOG_STAFF',
      })
      .expect(201);

    expect(res.body.sellerId).toBe(seller1Id);
  });

  // 16. Duplicate staff assignment rejected
  it('POST /api/sellers/me/staff - Duplicate staff assignment rejected (409 Conflict)', async () => {
    await request(app.getHttpServer())
      .post('/api/sellers/me/staff')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        targetUserId: seller2UserId,
        role: 'CATALOG_STAFF',
      })
      .expect(409);
  });

  // 21. Seller document privacy
  it('POST /api/sellers/me/documents - Seller uploads verification document', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sellers/me/documents')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        type: 'BUSINESS_LICENSE',
        fileReference: 'storage://docs/license_2026.pdf',
        fileName: 'License2026.pdf',
      })
      .expect(201);

    expect(res.body.type).toBe('BUSINESS_LICENSE');
  });

  // 13. Seller A cannot access Seller B documents
  it('GET /api/sellers/me/documents - Customer 2 cannot access Seller 1 documents', async () => {
    await request(app.getHttpServer())
      .get('/api/sellers/me/documents')
      .set('Authorization', `Bearer ${customer2Token}`)
      .expect(404);
  });

  // 18 & 19. Admin suspends seller -> suspended seller cannot perform seller actions
  it('POST /api/admin/sellers/:id/suspend - Admin suspends seller account', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/sellers/${seller1Id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Compliance audit' })
      .expect(201);

    // Verify suspended seller cannot update store profile (403 Forbidden)
    await request(app.getHttpServer())
      .patch('/api/sellers/me')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ businessName: 'Suspended Name' })
      .expect(403);
  });

  // 20. Admin activates seller account
  it('POST /api/admin/sellers/:id/activate - Admin activates seller account', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/admin/sellers/${seller1Id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(res.body.status).toBe('ACTIVE');
  });

  // 24. Audit events generated
  it('Verify SecurityAuditEvents were created for seller actions', () => {
    expect(mockAuditEvents.length).toBeGreaterThan(0);
    const approvedEvent = mockAuditEvents.find(
      (e: Record<string, unknown>) => e.event === 'SELLER_APPROVED',
    );
    expect(approvedEvent).toBeDefined();
  });
});
