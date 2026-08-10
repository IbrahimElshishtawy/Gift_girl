import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { INotificationProvider } from '../src/modules/auth/infrastructure/notification-provider.interface';

describe('Catalog + Categories + Products Domain Module (e2e)', () => {
  let app: INestApplication;

  const seller1Email = `seller1_cat_${Date.now()}@example.com`;
  const seller2Email = `seller2_cat_${Date.now()}@example.com`;
  const adminEmail = `admin_cat_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  let seller1Token: string;
  let seller2Token: string;
  let adminToken: string;

  let seller1Id: string;
  let seller2Id: string;

  let category1Id: string;
  const category1Slug = `dresses-${Date.now()}`;
  let brand1Id: string;
  const brand1Slug = `chanel-${Date.now()}`;

  let product1Id: string;
  const product1Slug = `floral-dress-${Date.now()}`;

  // In-memory data store for E2E mocks
  const mockUsers: Record<string, unknown>[] = [];
  const mockSessions: Record<string, unknown>[] = [];
  const mockApplications: Record<string, unknown>[] = [];
  const mockSellers: Record<string, unknown>[] = [];
  const mockStores: Record<string, unknown>[] = [];
  const mockUserRoles: Record<string, unknown>[] = [];
  const mockCategories: Record<string, unknown>[] = [];
  const mockBrands: Record<string, unknown>[] = [];
  const mockProducts: Record<string, unknown>[] = [];
  const mockOptions: Record<string, unknown>[] = [];
  const mockOptionValues: Record<string, unknown>[] = [];
  const mockVariants: Record<string, unknown>[] = [];
  const mockVariantOptionValues: Record<string, unknown>[] = [];
  const mockMedia: Record<string, unknown>[] = [];
  const mockAuditEvents: Record<string, unknown>[] = [];

  const mockRoles: Record<string, unknown>[] = [
    { id: 'r_1', code: 'CUSTOMER', name: 'Customer', isSystem: true },
    { id: 'r_2', code: 'SELLER', name: 'Seller', isSystem: true },
    { id: 'r_3', code: 'ADMIN', name: 'Admin', isSystem: true },
    { id: 'r_4', code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
  ];

  const mockPermissions: Record<string, unknown>[] = [
    { id: 'p_1', code: 'categories.read', resource: 'categories', action: 'read' },
    { id: 'p_2', code: 'categories.create', resource: 'categories', action: 'create' },
    { id: 'p_3', code: 'categories.update', resource: 'categories', action: 'update' },
    { id: 'p_4', code: 'categories.delete', resource: 'categories', action: 'delete' },
    { id: 'p_5', code: 'brands.read', resource: 'brands', action: 'read' },
    { id: 'p_6', code: 'brands.manage', resource: 'brands', action: 'manage' },
    { id: 'p_7', code: 'products.read', resource: 'products', action: 'read' },
    { id: 'p_8', code: 'products.create', resource: 'products', action: 'create' },
    { id: 'p_9', code: 'products.update', resource: 'products', action: 'update' },
    { id: 'p_10', code: 'products.delete', resource: 'products', action: 'delete' },
    { id: 'p_11', code: 'products.submit', resource: 'products', action: 'submit' },
    { id: 'p_12', code: 'products.review', resource: 'products', action: 'review' },
    { id: 'p_13', code: 'products.approve', resource: 'products', action: 'approve' },
    { id: 'p_14', code: 'products.reject', resource: 'products', action: 'reject' },
    { id: 'p_15', code: 'products.archive', resource: 'products', action: 'archive' },
    { id: 'p_16', code: 'product_media.manage', resource: 'product_media', action: 'manage' },
  ];

  const mockRolePermissions: Record<string, unknown>[] = [
    // ADMIN has all permissions
    ...mockPermissions.map((p) => ({ roleId: 'r_3', permissionId: p.id })),
    // SELLER permissions
    { roleId: 'r_2', permissionId: 'p_1' },
    { roleId: 'r_2', permissionId: 'p_5' },
    { roleId: 'r_2', permissionId: 'p_7' },
    { roleId: 'r_2', permissionId: 'p_8' },
    { roleId: 'r_2', permissionId: 'p_9' },
    { roleId: 'r_2', permissionId: 'p_10' },
    { roleId: 'r_2', permissionId: 'p_11' },
    { roleId: 'r_2', permissionId: 'p_15' },
    { roleId: 'r_2', permissionId: 'p_16' },
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
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockPrismaService);
      return Promise.all(cb);
    }),
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
            .map((ur: Record<string, unknown>) => {
              const roleObj = mockRoles.find((r: Record<string, unknown>) => r.id === ur.roleId);
              const rPermissions = roleObj
                ? mockRolePermissions
                    .filter((rp: Record<string, unknown>) => rp.roleId === roleObj.id)
                    .map((rp: Record<string, unknown>) => ({
                      ...rp,
                      permission: mockPermissions.find(
                        (p: Record<string, unknown>) => p.id === rp.permissionId,
                      ),
                    }))
                : [];
              return {
                ...ur,
                role: roleObj ? { ...roleObj, rolePermissions: rPermissions } : null,
              };
            });
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
          (s: Record<string, unknown>) => s.userId === where?.userId || s.id === where?.id,
        );
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newSeller = {
          id: `sel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          status: data.status || 'ACTIVE',
          verificationStatus: 'VERIFIED',
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
    store: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockStores.find((st: Record<string, unknown>) => {
          if (where?.sellerId && st.sellerId !== where.sellerId) return false;
          if (where?.slug && st.slug !== where.slug) return false;
          return true;
        });
        return Promise.resolve(found || null);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockStores.find(
          (st: Record<string, unknown>) => st.slug === where?.slug || st.id === where?.id,
        );
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newStore = {
          id: `str_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          status: data.status || 'DRAFT',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStores.push(newStore);
        return Promise.resolve(newStore);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockStores.findIndex((st: Record<string, unknown>) => st.id === where.id);
        if (idx !== -1) {
          mockStores[idx] = { ...mockStores[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockStores[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    category: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockCategories.find(
          (c: Record<string, unknown>) => c.id === where?.id || c.slug === where?.slug,
        );
        return Promise.resolve(found || null);
      }),
      findBySlug: jest.fn().mockImplementation(({ slug }) => {
        const found = mockCategories.find((c: Record<string, unknown>) => c.slug === slug);
        return Promise.resolve(found || null);
      }),
      findRootCategories: jest.fn().mockImplementation(() => Promise.resolve(mockCategories)),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let filtered = [...mockCategories];
        if (where?.parentId !== undefined) {
          filtered = filtered.filter((c: any) => (c.parentId || null) === where.parentId);
        }
        if (where?.status) {
          filtered = filtered.filter((c: any) => c.status === where.status);
        }
        return Promise.resolve(filtered);
      }),
      count: jest.fn().mockImplementation(() => Promise.resolve(mockCategories.length)),
      create: jest.fn().mockImplementation(({ data }) => {
        const newCat = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          parentId: data.parentId || null,
          status: data.status || 'ACTIVE',
          isActive: data.isActive !== undefined ? data.isActive : true,
          sortOrder: data.sortOrder || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockCategories.push(newCat);
        return Promise.resolve(newCat);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockCategories.findIndex((c: Record<string, unknown>) => c.id === where.id);
        if (idx !== -1) {
          mockCategories[idx] = { ...mockCategories[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockCategories[idx]);
        }
        return Promise.resolve(null);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const idx = mockCategories.findIndex((c: Record<string, unknown>) => c.id === where.id);
        if (idx !== -1) {
          const removed = mockCategories.splice(idx, 1)[0];
          return Promise.resolve(removed);
        }
        return Promise.resolve(null);
      }),
    },
    brand: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockBrands.find(
          (b: Record<string, unknown>) => b.id === where?.id || b.slug === where?.slug,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockBrands)),
      count: jest.fn().mockImplementation(() => Promise.resolve(mockBrands.length)),
      create: jest.fn().mockImplementation(({ data }) => {
        const newBrand = {
          id: `brd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          status: data.status || 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockBrands.push(newBrand);
        return Promise.resolve(newBrand);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockBrands.findIndex((b: Record<string, unknown>) => b.id === where.id);
        if (idx !== -1) {
          mockBrands[idx] = { ...mockBrands[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockBrands[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    product: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        let found: any = null;
        if (where?.id) {
          found = mockProducts.find((p: Record<string, unknown>) => p.id === where.id);
        } else if (where?.storeId_slug) {
          found = mockProducts.find(
            (p: Record<string, unknown>) =>
              p.storeId === where.storeId_slug.storeId && p.slug === where.storeId_slug.slug,
          );
        }
        if (!found) return Promise.resolve(null);

        const category = mockCategories.find((c: any) => c.id === found.categoryId);
        const brand = mockBrands.find((b: any) => b.id === found.brandId);
        const store = mockStores.find((st: any) => st.id === found.storeId);
        const options = mockOptions.filter((o: any) => o.productId === found.id);
        const variants = mockVariants.filter((v: any) => v.productId === found.id);
        const media = mockMedia.filter((m: any) => m.productId === found.id);

        return Promise.resolve({
          ...found,
          category,
          brand,
          store,
          options,
          variants,
          media,
          attributes: [],
        });
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockProducts.find((p: Record<string, unknown>) => {
          if (where?.slug && p.slug !== where.slug) return false;
          if (where?.status && p.status !== where.status) return false;
          if (where?.visibility && p.visibility !== where.visibility) return false;

          if (where?.store?.status || where?.store?.seller?.status) {
            const st = mockStores.find((s: any) => s.id === p.storeId);
            if (!st || st.status !== 'ACTIVE') return false;
            const sel = mockSellers.find((s: any) => s.id === st.sellerId);
            if (!sel || sel.status !== 'ACTIVE') return false;
          }

          if (where?.category?.status) {
            const cat = mockCategories.find((c: any) => c.id === p.categoryId);
            if (!cat || cat.status !== 'ACTIVE') return false;
          }

          return true;
        });

        if (!found) return Promise.resolve(null);

        const category = mockCategories.find((c: any) => c.id === found.categoryId);
        const brand = mockBrands.find((b: any) => b.id === found.brandId);

        return Promise.resolve({
          ...found,
          category,
          brand,
          options: [],
          variants: [],
          media: [],
          attributes: [],
        });
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        let filtered = [...mockProducts];

        if (where?.storeId) {
          filtered = filtered.filter((p: any) => p.storeId === where.storeId);
        }
        if (where?.status) {
          filtered = filtered.filter((p: any) => p.status === where.status);
        }
        if (where?.visibility) {
          filtered = filtered.filter((p: any) => p.visibility === where.visibility);
        }
        if (where?.categoryId) {
          filtered = filtered.filter((p: any) => p.categoryId === where.categoryId);
        }

        if (where?.store?.status || where?.store?.seller?.status) {
          filtered = filtered.filter((p: any) => {
            const st = mockStores.find((s: any) => s.id === p.storeId);
            if (!st || st.status !== 'ACTIVE') return false;
            const sel = mockSellers.find((s: any) => s.id === st.sellerId);
            return sel && sel.status === 'ACTIVE';
          });
        }

        if (where?.category?.status) {
          filtered = filtered.filter((p: any) => {
            const cat = mockCategories.find((c: any) => c.id === p.categoryId);
            return cat && cat.status === 'ACTIVE';
          });
        }

        const items = filtered.map((p) => ({
          ...p,
          category: mockCategories.find((c: any) => c.id === p.categoryId),
          brand: mockBrands.find((b: any) => b.id === p.brandId),
          options: [],
          variants: [],
          media: [],
          attributes: [],
        }));

        return Promise.resolve(items);
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        let filtered = [...mockProducts];
        if (where?.storeId) filtered = filtered.filter((p: any) => p.storeId === where.storeId);
        if (where?.status) filtered = filtered.filter((p: any) => p.status === where.status);
        return Promise.resolve(filtered.length);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newProduct = {
          id: `prd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          storeId: data.store.connect.id,
          categoryId: data.category.connect.id,
          brandId: data.brand?.connect?.id || null,
          name: data.name,
          slug: data.slug,
          shortDescription: data.shortDescription || null,
          description: data.description || null,
          status: data.status || 'DRAFT',
          visibility: data.visibility || 'PUBLIC',
          basePrice: data.basePrice,
          compareAtPrice: data.compareAtPrice || null,
          currency: data.currency || 'EGP',
          rejectionReason: null,
          publishedAt: null,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockProducts.push(newProduct);
        return Promise.resolve(newProduct);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockProducts.findIndex((p: Record<string, unknown>) => p.id === where.id);
        if (idx !== -1) {
          mockProducts[idx] = { ...mockProducts[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockProducts[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    productOption: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newOpt = {
          id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockOptions.push(newOpt);
        return Promise.resolve(newOpt);
      }),
    },
    productOptionValue: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newVal = {
          id: `opt_val_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockOptionValues.push(newVal);
        return Promise.resolve(newVal);
      }),
    },
    productVariant: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockVariants.find((v: Record<string, unknown>) => v.sku === where?.sku || v.id === where?.id);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newVariant = {
          id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: data.productId,
          sku: data.sku,
          price: data.price || null,
          compareAtPrice: data.compareAtPrice || null,
          optionCombinationHash: data.optionCombinationHash || null,
          isDefault: data.isDefault || false,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockVariants.push(newVariant);
        return Promise.resolve(newVariant);
      }),
    },
    productMedia: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newMedia = {
          id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: data.product.connect.id,
          type: data.type || 'IMAGE',
          url: data.url,
          altText: data.altText || null,
          sortOrder: data.sortOrder || 0,
          isPrimary: data.isPrimary || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockMedia.push(newMedia);
        return Promise.resolve(newMedia);
      }),
      delete: jest.fn().mockImplementation(({ where }) => {
        const idx = mockMedia.findIndex((m: Record<string, unknown>) => m.id === where.id);
        if (idx !== -1) {
          const removed = mockMedia.splice(idx, 1)[0];
          return Promise.resolve(removed);
        }
        return Promise.resolve(null);
      }),
    },
    role: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockRoles.find((r: Record<string, unknown>) => r.code === where.code || r.id === where.id);
        if (!found) return Promise.resolve(null);
        const rPermissions = mockRolePermissions
          .filter((rp: Record<string, unknown>) => rp.roleId === found.id)
          .map((rp: Record<string, unknown>) => ({
            ...rp,
            permission: mockPermissions.find((p: Record<string, unknown>) => p.id === rp.permissionId),
          }));
        return Promise.resolve({ ...found, rolePermissions: rPermissions });
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockRoles)),
    },
    permission: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockPermissions.find(
          (p: Record<string, unknown>) => p.code === where.code || p.id === where.id,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockPermissions)),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `p_${Date.now()}`, ...data })),
      upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: `p_${Date.now()}`, ...create })),
    },
    verificationToken: {
      create: jest.fn().mockResolvedValue({ id: 'v_1' }),
      findFirst: jest.fn().mockResolvedValue(null),
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
      create: jest.fn().mockImplementation(({ data }) => {
        mockUserRoles.push(data);
        return Promise.resolve(data);
      }),
    },
    securityAuditEvent: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newEvent = {
          id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          createdAt: new Date(),
        };
        mockAuditEvents.push(newEvent);
        return Promise.resolve(newEvent);
      }),
    },
    authSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newSession = {
          id: `ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSessions.push(newSession);
        return Promise.resolve(newSession);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockSessions.find((s: Record<string, unknown>) => s.id === where.id);
        return Promise.resolve(found || null);
      }),
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
      mockRedisMap.delete(key);
      return Promise.resolve(1);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider('INotificationProvider')
      .useValue(mockNotificationProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Setup Accounts & Token Helper
  it('Setup: Register & Auth Admin, Seller 1, and Seller 2', async () => {
    // 1. Admin
    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: adminEmail, password: testPassword });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.tokens.accessToken;

    const adminUser: any = mockUsers.find((u: any) => u.email === adminEmail);
    if (adminUser) adminUser.status = 'ACTIVE';
    const adminRole = mockRoles.find((r: any) => r.code === 'ADMIN');
    mockUserRoles.push({ userId: adminUser!.id, roleId: adminRole!.id });

    // 2. Seller 1
    const s1Res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: seller1Email, password: testPassword });
    expect(s1Res.status).toBe(201);
    seller1Token = s1Res.body.tokens.accessToken;
    const seller1User: any = mockUsers.find((u: any) => u.email === seller1Email);
    if (seller1User) seller1User.status = 'ACTIVE';

    const s1Role = mockRoles.find((r: any) => r.code === 'SELLER');
    mockUserRoles.push({ userId: seller1User.id, roleId: s1Role!.id });

    const seller1Obj = {
      id: `sel_1`,
      userId: seller1User.id,
      businessName: 'Seller 1 Boutique',
      phone: '+201000000001',
      email: seller1Email,
      governorateState: 'Cairo',
      city: 'Cairo',
      address: 'Downtown',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    };
    mockSellers.push(seller1Obj);
    seller1Id = seller1Obj.id;

    const store1Obj = {
      id: `str_1`,
      sellerId: seller1Id,
      name: 'Lotus Boutique',
      slug: 'lotus-boutique',
      status: 'ACTIVE',
      contactEmail: seller1Email,
      contactPhone: '+201000000001',
      governorateState: 'Cairo',
      city: 'Cairo',
    };
    mockStores.push(store1Obj);

    // 3. Seller 2
    const s2Res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: seller2Email, password: testPassword });
    expect(s2Res.status).toBe(201);
    seller2Token = s2Res.body.tokens.accessToken;
    const seller2User: any = mockUsers.find((u: any) => u.email === seller2Email);
    if (seller2User) seller2User.status = 'ACTIVE';

    mockUserRoles.push({ userId: seller2User.id, roleId: s1Role!.id });

    const seller2Obj = {
      id: `sel_2`,
      userId: seller2User.id,
      businessName: 'Seller 2 Boutique',
      phone: '+201000000002',
      email: seller2Email,
      governorateState: 'Giza',
      city: 'Giza',
      address: 'Haram',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    };
    mockSellers.push(seller2Obj);
    seller2Id = seller2Obj.id;

    const store2Obj = {
      id: `str_2`,
      sellerId: seller2Id,
      name: 'Rose Store',
      slug: 'rose-store',
      status: 'ACTIVE',
      contactEmail: seller2Email,
      contactPhone: '+201000000002',
      governorateState: 'Giza',
      city: 'Giza',
    };
    mockStores.push(store2Obj);
  });

  // --- CATEGORIES ---
  describe('Category Management', () => {
    it('POST /api/admin/categories - Admin creates category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dresses',
          slug: category1Slug,
          description: 'Women elegant dresses',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Dresses');
      expect(res.body.slug).toBe(category1Slug);
      category1Id = res.body.id;
    });

    it('GET /api/categories - Public category hierarchy retrieval', async () => {
      const res = await request(app.getHttpServer()).get('/api/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('POST /api/sellers/me/products - Seller cannot create category (403/404)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/categories')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({ name: 'Prohibited' });
      expect(res.status).toBe(403);
    });
  });

  // --- BRANDS ---
  describe('Brand Management', () => {
    it('POST /api/admin/brands - Admin creates official brand', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Chanel',
          slug: brand1Slug,
          description: 'Luxury French brand',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Chanel');
      brand1Id = res.body.id;
    });
  });

  // --- PRODUCTS & LIFECYCLE ---
  describe('Product Lifecycle & Moderation', () => {
    it('POST /api/sellers/me/products - Seller 1 creates product in DRAFT status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/sellers/me/products')
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          categoryId: category1Id,
          brandId: brand1Id,
          name: 'Floral Maxi Dress',
          slug: product1Slug,
          shortDescription: 'Elegant floral dress',
          description: '<p>Handmade cotton dress <script>alert("xss")</script></p>',
          basePrice: 499.99,
          compareAtPrice: 699.99,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.description).not.toContain('<script>');
      product1Id = res.body.id;
    });

    it('GET /api/products/slug/:slug - DRAFT product is NOT publicly visible (404 Not Found)', async () => {
      const res = await request(app.getHttpServer()).get(`/api/products/slug/${product1Slug}`);
      expect(res.status).toBe(404);
    });

    it('POST /api/sellers/me/products/:id/submit - Seller submits product for admin review', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sellers/me/products/${product1Id}/submit`)
        .set('Authorization', `Bearer ${seller1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING_REVIEW');
    });

    it('POST /api/admin/products/:id/approve - Admin approves product publication', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/admin/products/${product1Id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ publishImmediately: true });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PUBLISHED');
    });

    it('GET /api/products/slug/:slug - PUBLISHED product is publicly visible (200 OK)', async () => {
      const res = await request(app.getHttpServer()).get(`/api/products/slug/${product1Slug}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(product1Id);
      expect(res.body.name).toBe('Floral Maxi Dress');
    });
  });

  // --- VARIANTS & SKU ---
  describe('Product Variants & SKU Management', () => {
    it('POST /api/sellers/me/products/:id/options - Seller 1 creates option dimension', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sellers/me/products/${product1Id}/options`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          name: 'Color',
          values: [{ value: 'Black' }, { value: 'Red' }],
        });

      expect(res.status).toBe(201);
    });

    it('POST /api/sellers/me/products/:id/variants - Seller 1 creates variant with SKU', async () => {
      const optVal = mockOptionValues.find((v: any) => v.value === 'Black');
      const res = await request(app.getHttpServer())
        .post(`/api/sellers/me/products/${product1Id}/variants`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          sku: 'DRESS-BLK-S',
          price: 499.99,
          optionValueIds: [optVal ? optVal.id : 'opt_val_dummy'],
        });

      expect(res.status).toBe(201);
      expect(res.body.sku).toBe('DRESS-BLK-S');
    });

    it('POST /api/sellers/me/products/:id/variants - Duplicate SKU is rejected (409 Conflict)', async () => {
      const optVal = mockOptionValues.find((v: any) => v.value === 'Red');
      const res = await request(app.getHttpServer())
        .post(`/api/sellers/me/products/${product1Id}/variants`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          sku: 'DRESS-BLK-S',
          price: 499.99,
          optionValueIds: [optVal ? optVal.id : 'opt_val_dummy_2'],
        });

      expect(res.status).toBe(409);
    });
  });

  // --- MEDIA ---
  describe('Product Media Management', () => {
    it('POST /api/sellers/me/products/:id/media - Seller 1 adds product media reference', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sellers/me/products/${product1Id}/media`)
        .set('Authorization', `Bearer ${seller1Token}`)
        .send({
          url: 'https://storage.example.com/dress_main.jpg',
          altText: 'Main Dress View',
          isPrimary: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.url).toBe('https://storage.example.com/dress_main.jpg');
    });
  });

  // --- OWNERSHIP & ISOLATION ---
  describe('Seller Ownership & IDOR Security', () => {
    it('PATCH /api/sellers/me/products/:id - Seller 2 CANNOT modify Seller 1 product (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/sellers/me/products/${product1Id}`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ name: 'Hacked Product Name' });

      expect(res.status).toBe(404);
    });

    it('POST /api/sellers/me/products/:id/variants - Seller 2 CANNOT add variant to Seller 1 product (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/sellers/me/products/${product1Id}/variants`)
        .set('Authorization', `Bearer ${seller2Token}`)
        .send({ sku: 'HACK-SKU-123', optionValueIds: [] });

      expect(res.status).toBe(404);
    });
  });

  // --- AUDIT LOGGING ---
  describe('Audit Logging Verification', () => {
    it('Verify SecurityAuditEvents were created for catalog actions', async () => {
      expect(mockAuditEvents.length).toBeGreaterThan(0);
      const events = mockAuditEvents.map((e: any) => e.event);
      expect(events).toContain('CATEGORY_CREATED');
      expect(events).toContain('BRAND_CREATED');
      expect(events).toContain('PRODUCT_CREATED');
      expect(events).toContain('PRODUCT_SUBMITTED');
      expect(events).toContain('PRODUCT_PUBLISHED');
    });
  });
});
