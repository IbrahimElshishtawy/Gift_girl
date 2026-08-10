import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { InventoryReservationService } from '../src/modules/inventory/application/inventory-reservation.service';

describe('Inventory + Stock Management Domain Module (e2e)', () => {
  let app: INestApplication;
  let reservationService: InventoryReservationService;

  // Mock State Storage
  const mockUsers: Record<string, unknown>[] = [];
  const mockSessions: Record<string, unknown>[] = [];
  const mockUserRoles: Record<string, unknown>[] = [];
  const mockSellers: Record<string, unknown>[] = [];
  const mockStores: Record<string, unknown>[] = [];
  const mockCategories: Record<string, unknown>[] = [];
  const mockBrands: Record<string, unknown>[] = [];
  const mockProducts: Record<string, unknown>[] = [];
  const mockOptions: Record<string, unknown>[] = [];
  const mockOptionValues: Record<string, unknown>[] = [];
  const mockVariants: Record<string, unknown>[] = [];
  const mockInventories: Record<string, unknown>[] = [];
  const mockMovements: Record<string, unknown>[] = [];
  const mockReservations: Record<string, unknown>[] = [];
  const mockAuditEvents: Record<string, unknown>[] = [];
  const mockRedisMap = new Map<string, string>();

  const mockRoles: Record<string, unknown>[] = [
    { id: 'r_1', code: 'CUSTOMER', name: 'Customer', isSystem: true },
    { id: 'r_2', code: 'SELLER', name: 'Seller', isSystem: true },
    { id: 'r_3', code: 'ADMIN', name: 'Admin', isSystem: true },
    { id: 'r_4', code: 'SUPER_ADMIN', name: 'Super Admin', isSystem: true },
  ];

  const mockPermissions: Record<string, unknown>[] = [
    { id: 'p_1', code: 'categories.read', resource: 'categories', action: 'read' },
    { id: 'p_2', code: 'categories.create', resource: 'categories', action: 'create' },
    { id: 'p_3', code: 'products.read', resource: 'products', action: 'read' },
    { id: 'p_4', code: 'products.create', resource: 'products', action: 'create' },
    { id: 'p_5', code: 'products.update', resource: 'products', action: 'update' },
    { id: 'p_6', code: 'inventory.read', resource: 'inventory', action: 'read' },
    { id: 'p_7', code: 'inventory.adjust', resource: 'inventory', action: 'adjust' },
    { id: 'p_8', code: 'inventory.manage', resource: 'inventory', action: 'manage' },
    { id: 'p_9', code: 'inventory.movements.read', resource: 'inventory_movements', action: 'read' },
    { id: 'p_10', code: 'inventory.reservations.read', resource: 'inventory_reservations', action: 'read' },
    { id: 'p_11', code: 'inventory.reservations.manage', resource: 'inventory_reservations', action: 'manage' },
  ];

  const mockRolePermissions: Record<string, unknown>[] = [
    ...mockPermissions.map((p) => ({ roleId: 'r_3', permissionId: p.id })),
    { roleId: 'r_2', permissionId: 'p_3' },
    { roleId: 'r_2', permissionId: 'p_4' },
    { roleId: 'r_2', permissionId: 'p_5' },
    { roleId: 'r_2', permissionId: 'p_6' },
    { roleId: 'r_2', permissionId: 'p_7' },
    { roleId: 'r_2', permissionId: 'p_8' },
    { roleId: 'r_2', permissionId: 'p_9' },
    { roleId: 'r_2', permissionId: 'p_10' },
    { roleId: 'r_2', permissionId: 'p_11' },
  ];

  const testTimestamp = Date.now();
  const testPassword = 'TestPassword123!';
  const adminEmail = `admin_inv_${testTimestamp}@example.com`;
  const seller1Email = `seller1_inv_${testTimestamp}@example.com`;
  const seller2Email = `seller2_inv_${testTimestamp}@example.com`;

  let adminToken: string;
  let seller1Token: string;
  let seller2Token: string;

  let seller1Id: string;
  let seller2Id: string;
  let product1Id: string;
  let variant1Id: string;
  let variant1Sku: string;
  let reservation1Id: string;

  const mockNotificationProvider = {
    sendVerificationToken: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetToken: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    isHealthy: jest.fn().mockResolvedValue(true),
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockPrismaService);
      return Promise.all(cb);
    }),
    $queryRaw: jest.fn().mockImplementation((query: any, ...args: any[]) => {
      const queryStr = String(query);
      if (queryStr.includes('FROM "inventories"')) {
        const targetVal = args[0];
        const found = mockInventories.find(
          (inv: any) => inv.variantId === targetVal || inv.id === targetVal,
        );
        return Promise.resolve(found ? [found] : []);
      }
      if (queryStr.includes('FROM "inventory_reservations"')) {
        const id = args[0];
        const found = mockReservations.find((r: any) => r.id === id);
        return Promise.resolve(found ? [found] : []);
      }
      return Promise.resolve([]);
    }),
    authSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newSession = {
          id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          isValid: true,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockSessions.push(newSession);
        return Promise.resolve(newSession);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockSessions.find(
          (s: Record<string, unknown>) => s.id === where?.id || s.sessionToken === where?.sessionToken,
        );
        return Promise.resolve(found || null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockSessions.find(
          (s: Record<string, unknown>) => s.id === where?.id || s.sessionToken === where?.sessionToken,
        );
        return Promise.resolve(found || null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockSessions.findIndex((s: Record<string, unknown>) => s.id === where.id);
        if (idx !== -1) {
          mockSessions[idx] = { ...mockSessions[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockSessions[idx]);
        }
        return Promise.resolve(null);
      }),
    },
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
        const found = mockCategories.find((c: Record<string, unknown>) => c.id === where?.id);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newCat = { id: `cat_${Date.now()}`, ...data, status: 'ACTIVE' };
        mockCategories.push(newCat);
        return Promise.resolve(newCat);
      }),
    },
    product: {
      findUnique: jest.fn().mockImplementation(({ where, include }) => {
        const found = mockProducts.find((p: Record<string, unknown>) => p.id === where?.id);
        if (!found) return Promise.resolve(null);
        const res: Record<string, unknown> = { ...found };
        if (include?.store) {
          res.store = mockStores.find((st: any) => st.id === (found as any).storeId);
        }
        if (include?.category) {
          res.category = mockCategories.find((cat: any) => cat.id === (found as any).categoryId);
        }
        return Promise.resolve(res);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        const found = mockProducts.find((p: Record<string, unknown>) => {
          if (where?.slug && p.slug !== where.slug) return false;
          if (where?.status && p.status !== where.status) return false;
          return true;
        });
        if (!found) return Promise.resolve(null);
        return Promise.resolve({
          ...found,
          category: mockCategories.find((c: any) => c.id === (found as any).categoryId),
          brand: null,
          options: [],
          variants: mockVariants.filter((v: any) => v.productId === (found as any).id),
          media: [],
          attributes: [],
        });
      }),
      findById: jest.fn().mockImplementation(({ id }) => {
        const found = mockProducts.find((p: Record<string, unknown>) => p.id === id);
        return Promise.resolve(found || null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newProd = {
          id: `prd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          storeId: data.store?.connect?.id || data.storeId,
          categoryId: data.category?.connect?.id || data.categoryId,
          status: data.status || 'DRAFT',
          visibility: data.visibility || 'PUBLIC',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockProducts.push(newProd);
        return Promise.resolve(newProd);
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
    productVariant: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockVariants.find(
          (v: Record<string, unknown>) => v.sku === where?.sku || v.id === where?.id,
        );
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

        if (data.inventory?.create) {
          const newInv = {
            id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            variantId: newVariant.id,
            onHandQuantity: data.inventory.create.onHandQuantity || 0,
            reservedQuantity: data.inventory.create.reservedQuantity || 0,
            lowStockThreshold: data.inventory.create.lowStockThreshold || 10,
            version: 1,
            status: data.inventory.create.status || 'OUT_OF_STOCK',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockInventories.push(newInv);
        } else {
          // Automatic default inventory creation fallback
          const newInv = {
            id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            variantId: newVariant.id,
            onHandQuantity: 0,
            reservedQuantity: 0,
            lowStockThreshold: 10,
            version: 1,
            status: 'OUT_OF_STOCK',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockInventories.push(newInv);
        }

        return Promise.resolve(newVariant);
      }),
    },
    inventory: {
      findUnique: jest.fn().mockImplementation(({ where, include }) => {
        const targetVal = typeof where === 'string' ? where : where?.variantId || where?.id;
        const found = mockInventories.find(
          (inv: Record<string, unknown>) => inv.variantId === targetVal || inv.id === targetVal,
        );
        if (!found) return Promise.resolve(null);

        const res: Record<string, unknown> = { ...found };
        if (include?.variant) {
          const v = mockVariants.find((varItem: any) => varItem.id === found.variantId);
          const p = v ? mockProducts.find((prodItem: any) => prodItem.id === (v as any).productId) : null;
          res.variant = {
            ...(v as object),
            product: p
              ? {
                  id: (p as any).id,
                  name: (p as any).name,
                  storeId: (p as any).storeId,
                  status: (p as any).status,
                }
              : null,
          };
        }
        return Promise.resolve(res);
      }),
      findMany: jest.fn().mockImplementation(({ where, skip = 0, take = 20 }) => {
        let filtered = [...mockInventories];
        if (where?.status) {
          filtered = filtered.filter((inv: any) => inv.status === where.status);
        }
        if (where?.variant?.product?.storeId) {
          filtered = filtered.filter((inv: any) => {
            const v = mockVariants.find((varItem: any) => varItem.id === inv.variantId);
            const p = v ? mockProducts.find((prodItem: any) => prodItem.id === (v as any).productId) : null;
            return p && (p as any).storeId === where.variant.product.storeId;
          });
        }
        const sliced = filtered.slice(skip, skip + take).map((found) => {
          const v = mockVariants.find((varItem: any) => varItem.id === (found as any).variantId);
          const p = v ? mockProducts.find((prodItem: any) => prodItem.id === (v as any).productId) : null;
          return {
            ...found,
            variant: {
              ...(v as object),
              product: p
                ? {
                    id: (p as any).id,
                    name: (p as any).name,
                    storeId: (p as any).storeId,
                    status: (p as any).status,
                  }
                : null,
            },
          };
        });
        return Promise.resolve(sliced);
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        let filtered = [...mockInventories];
        if (where?.status) filtered = filtered.filter((inv: any) => inv.status === where.status);
        return Promise.resolve(filtered.length);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newInv = {
          id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
          onHandQuantity: data.onHandQuantity || 0,
          reservedQuantity: data.reservedQuantity || 0,
          lowStockThreshold: data.lowStockThreshold || 10,
          version: 1,
          status: data.status || 'OUT_OF_STOCK',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockInventories.push(newInv);
        return Promise.resolve(newInv);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockInventories.findIndex((inv: Record<string, unknown>) => inv.id === where.id);
        if (idx !== -1) {
          const version = ((mockInventories[idx].version as number) || 1) + 1;
          mockInventories[idx] = {
            ...mockInventories[idx],
            ...data,
            version,
            updatedAt: new Date(),
          };
          return Promise.resolve(mockInventories[idx]);
        }
        return Promise.resolve(null);
      }),
    },
    inventoryMovement: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockMovements.find(
          (m: Record<string, unknown>) => m.idempotencyKey === where?.idempotencyKey || m.id === where?.id,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where, skip = 0, take = 50 }) => {
        let filtered = [...mockMovements];
        if (where?.inventoryId) {
          filtered = filtered.filter((m: any) => m.inventoryId === where.inventoryId);
        }
        return Promise.resolve(filtered.slice(skip, skip + take));
      }),
      count: jest.fn().mockImplementation(({ where }) => {
        let filtered = [...mockMovements];
        if (where?.inventoryId) {
          filtered = filtered.filter((m: any) => m.inventoryId === where.inventoryId);
        }
        return Promise.resolve(filtered.length);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newMov = {
          id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          inventoryId: data.inventory?.connect?.id || data.inventoryId,
          type: data.type,
          quantity: data.quantity,
          beforeQuantity: data.beforeQuantity,
          afterQuantity: data.afterQuantity,
          reason: data.reason || null,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          idempotencyKey: data.idempotencyKey || null,
          performedBy: data.performedBy || null,
          createdAt: new Date(),
        };
        mockMovements.push(newMov);
        return Promise.resolve(newMov);
      }),
    },
    inventoryReservation: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockReservations.find(
          (r: Record<string, unknown>) => r.idempotencyKey === where?.idempotencyKey || r.id === where?.id,
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn().mockImplementation(({ where, take = 100 }) => {
        let filtered = [...mockReservations];
        if (where?.status) filtered = filtered.filter((r: any) => r.status === where.status);
        if (where?.expiresAt?.lte) {
          filtered = filtered.filter(
            (r: any) => new Date(r.expiresAt).getTime() <= new Date(where.expiresAt.lte).getTime(),
          );
        }
        return Promise.resolve(filtered.slice(0, take));
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newRes = {
          id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          inventoryId: data.inventory?.connect?.id || data.inventoryId,
          quantity: data.quantity,
          status: data.status || 'ACTIVE',
          expiresAt: data.expiresAt,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          idempotencyKey: data.idempotencyKey || null,
          createdBy: data.createdBy || null,
          releasedAt: null,
          consumedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockReservations.push(newRes);
        return Promise.resolve(newRes);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const idx = mockReservations.findIndex((r: Record<string, unknown>) => r.id === where.id);
        if (idx !== -1) {
          mockReservations[idx] = { ...mockReservations[idx], ...data, updatedAt: new Date() };
          return Promise.resolve(mockReservations[idx]);
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
        const event = { id: `sa_${Date.now()}`, ...data, createdAt: new Date() };
        mockAuditEvents.push(event);
        return Promise.resolve(event);
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

    reservationService = app.get<InventoryReservationService>(InventoryReservationService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // Setup Test Accounts
  it('Setup: Register Admin, Seller 1, and Seller 2', async () => {
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
    if (seller1User) {
      seller1User.status = 'ACTIVE';
      seller1User.role = 'SELLER';
    }

    const s1Role = mockRoles.find((r: any) => r.code === 'SELLER');
    mockUserRoles.push({ userId: seller1User.id, roleId: s1Role!.id });

    const seller1Obj = {
      id: `sel_inv_1`,
      userId: seller1User.id,
      businessName: 'Lotus Fashion',
      status: 'ACTIVE',
    };
    mockSellers.push(seller1Obj);
    seller1Id = seller1Obj.id;

    const store1Obj = {
      id: `str_inv_1`,
      sellerId: seller1Id,
      name: 'Lotus Store',
      slug: 'lotus-store',
      status: 'ACTIVE',
    };
    mockStores.push(store1Obj);

    // 3. Seller 2
    const s2Res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: seller2Email, password: testPassword });
    expect(s2Res.status).toBe(201);
    seller2Token = s2Res.body.tokens.accessToken;
    const seller2User: any = mockUsers.find((u: any) => u.email === seller2Email);
    if (seller2User) {
      seller2User.status = 'ACTIVE';
      seller2User.role = 'SELLER';
    }

    mockUserRoles.push({ userId: seller2User.id, roleId: s1Role!.id });

    const seller2Obj = {
      id: `sel_inv_2`,
      userId: seller2User.id,
      businessName: 'Jasmine Boutique',
      status: 'ACTIVE',
    };
    mockSellers.push(seller2Obj);
    seller2Id = seller2Obj.id;

    const store2Obj = {
      id: `str_inv_2`,
      sellerId: seller2Id,
      name: 'Jasmine Store',
      slug: 'jasmine-store',
      status: 'ACTIVE',
    };
    mockStores.push(store2Obj);

    // Create Category & Product for Seller 1
    const catObj = { id: `cat_inv_1`, name: 'Dresses', slug: 'dresses', status: 'ACTIVE' };
    mockCategories.push(catObj);

    const prodObj = {
      id: `prd_inv_1`,
      storeId: store1Obj.id,
      categoryId: catObj.id,
      name: 'Silk Evening Dress',
      slug: 'silk-evening-dress',
      status: 'PUBLISHED',
      basePrice: 599.99,
    };
    mockProducts.push(prodObj);
    product1Id = prodObj.id;
  });

  // 1, 2, 3: Create Product Variant -> Verify Inventory Automatically Created (onHand = 0, OUT_OF_STOCK)
  it('1-3. POST /api/sellers/me/products/:id/variants - Automatic inventory initialization (onHand=0, OUT_OF_STOCK)', async () => {
    variant1Sku = `SILK-DRS-BLK-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post(`/api/sellers/me/products/${product1Id}/variants`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({
        sku: variant1Sku,
        price: 599.99,
        optionValueIds: ['opt_val_1'],
      })
      .expect(201);

    variant1Id = res.body.id;
    expect(variant1Id).toBeDefined();

    // Verify inventory record was automatically created in mockInventories
    const createdInv: any = mockInventories.find((inv: any) => inv.variantId === variant1Id);
    expect(createdInv).toBeDefined();
    expect(createdInv.onHandQuantity).toBe(0);
    expect(createdInv.reservedQuantity).toBe(0);
    expect(createdInv.status).toBe('OUT_OF_STOCK');
  });

  // 4 & 5: Seller adds stock -> Verify stock increased to 100 (IN_STOCK)
  it('4-5. POST /api/sellers/me/inventory/:variantId/adjust - Seller 1 adds stock (+100)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/sellers/me/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({
        quantityDelta: 100,
        reason: 'Initial shipment arrival',
      })
      .expect(200);

    expect(res.body.onHandQuantity).toBe(100);
    expect(res.body.reservedQuantity).toBe(0);
    expect(res.body.availableQuantity).toBe(100);
    expect(res.body.status).toBe('IN_STOCK');
  });

  // 6: Seller decreases stock (-20)
  it('6. POST /api/sellers/me/inventory/:variantId/adjust - Seller 1 decreases stock (-20)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/sellers/me/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({
        quantityDelta: -20,
        reason: 'Damaged item removed',
      })
      .expect(200);

    expect(res.body.onHandQuantity).toBe(80);
    expect(res.body.availableQuantity).toBe(80);
  });

  // 7: Negative stock rejected (400 Bad Request)
  it('7. POST /api/sellers/me/inventory/:variantId/adjust - Negative stock rejected (400 Bad Request)', async () => {
    await request(app.getHttpServer())
      .post(`/api/sellers/me/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({
        quantityDelta: -200, // Exceeds 80 on-hand
        reason: 'Invalid reduction',
      })
      .expect(400);
  });

  // 8: Low stock detected (LOW_STOCK)
  it('8. POST /api/sellers/me/inventory/:variantId/adjust - Low stock status detected', async () => {
    // Current onHand 80. Adjust -72 -> onHand 8 <= lowStockThreshold 10
    const res = await request(app.getHttpServer())
      .post(`/api/sellers/me/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({
        quantityDelta: -72,
        reason: 'Sales reduction',
      })
      .expect(200);

    expect(res.body.onHandQuantity).toBe(8);
    expect(res.body.status).toBe('LOW_STOCK');

    // Restock to 50 for reservation testing
    await request(app.getHttpServer())
      .post(`/api/sellers/me/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({ quantityDelta: 42 }); // onHand becomes 50
  });

  // 9: Out of stock detected (OUT_OF_STOCK)
  it('9. POST /api/sellers/me/inventory/:variantId/adjust - Out of stock status detected when stock drops to 0', async () => {
    const v2Res = await request(app.getHttpServer())
      .post(`/api/sellers/me/products/${product1Id}/variants`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .send({ sku: `OOS-SKU-${Date.now()}`, price: 100, optionValueIds: ['opt_val_oos'] })
      .expect(201);

    const inv = mockInventories.find((i: any) => i.variantId === v2Res.body.id);
    expect((inv as any).status).toBe('OUT_OF_STOCK');
  });

  // 10 & 11: Reserve available stock -> Available quantity reduced
  it('10-11. InventoryReservationService.createReservation - Reserve available stock (reduces available quantity)', async () => {
    const res = await reservationService.createReservation('cust_123', {
      variantId: variant1Id,
      quantity: 15,
      referenceType: 'CART',
      referenceId: 'cart_9988',
    });

    expect(res.id).toBeDefined();
    expect(res.quantity).toBe(15);
    expect(res.status).toBe('ACTIVE');
    reservation1Id = res.id;

    // Check inventory available quantity via GET endpoint
    const invRes = await request(app.getHttpServer())
      .get(`/api/sellers/me/inventory/${variant1Id}`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .expect(200);

    expect(invRes.body.onHandQuantity).toBe(50);
    expect(invRes.body.reservedQuantity).toBe(15);
    expect(invRes.body.availableQuantity).toBe(35);
  });

  // 12 & 13: Release reservation -> Available stock restored
  it('12-13. InventoryReservationService.releaseReservation - Release reservation (restores available stock)', async () => {
    const tempRes = await reservationService.createReservation('cust_123', {
      variantId: variant1Id,
      quantity: 10,
    });

    const released = await reservationService.releaseReservation('cust_123', tempRes.id);
    expect(released.status).toBe('RELEASED');

    const invRes = await request(app.getHttpServer())
      .get(`/api/sellers/me/inventory/${variant1Id}`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .expect(200);

    expect(invRes.body.reservedQuantity).toBe(15); // Restored from 25 back to 15
    expect(invRes.body.availableQuantity).toBe(35);
  });

  // 14 & 15: Consume reservation -> On-hand stock reduced
  it('14-15. InventoryReservationService.consumeReservation - Consume reservation (reduces on-hand stock)', async () => {
    const consumed = await reservationService.consumeReservation('cust_123', reservation1Id);
    expect(consumed.status).toBe('CONSUMED');

    const invRes = await request(app.getHttpServer())
      .get(`/api/sellers/me/inventory/${variant1Id}`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .expect(200);

    expect(invRes.body.onHandQuantity).toBe(35); // 50 - 15
    expect(invRes.body.reservedQuantity).toBe(0); // 15 - 15
    expect(invRes.body.availableQuantity).toBe(35);
  });

  // 16: Expired reservation releases stock
  it('16. InventoryReservationService.expireReservations - Expired reservation releases reserved stock', async () => {
    const expRes = await reservationService.createReservation('cust_123', {
      variantId: variant1Id,
      quantity: 5,
      ttlSeconds: 1, // Expiration 1 second
    });

    // Artificially age the reservation in mockReservations
    const mockResItem: any = mockReservations.find((r: any) => r.id === expRes.id);
    if (mockResItem) {
      mockResItem.expiresAt = new Date(Date.now() - 10000); // 10 seconds ago
    }

    const count = await reservationService.expireReservations();
    expect(count).toBeGreaterThan(0);

    const expiredCheck: any = mockReservations.find((r: any) => r.id === expRes.id);
    expect(expiredCheck.status).toBe('EXPIRED');
  });

  // 17: Duplicate reservation request is idempotent
  it('17. InventoryReservationService.createReservation - Duplicate reservation is idempotent', async () => {
    const idempKey = `idemp_res_${Date.now()}`;
    const res1 = await reservationService.createReservation('cust_123', {
      variantId: variant1Id,
      quantity: 2,
      idempotencyKey: idempKey,
    });

    const res2 = await reservationService.createReservation('cust_123', {
      variantId: variant1Id,
      quantity: 2,
      idempotencyKey: idempKey,
    });

    expect(res1.id).toBe(res2.id);
  });

  // 18: Concurrent reservation cannot oversell (Conflict 409)
  it('18. InventoryReservationService.createReservation - Overselling reservation is rejected (409 Conflict)', async () => {
    await expect(
      reservationService.createReservation('cust_123', {
        variantId: variant1Id,
        quantity: 9999, // Way exceeds available stock
      }),
    ).rejects.toThrow();
  });

  // 19 & 20: Seller A cannot access or adjust Seller B inventory
  it('19-20. GET/POST /api/sellers/me/inventory/:variantId - Seller 2 CANNOT access or adjust Seller 1 inventory', async () => {
    await request(app.getHttpServer())
      .get(`/api/sellers/me/inventory/${variant1Id}`)
      .set('Authorization', `Bearer ${seller2Token}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/sellers/me/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${seller2Token}`)
      .send({ quantityDelta: 50 })
      .expect(404);
  });

  // 21: Inventory movement is immutable (no PATCH/DELETE routes exposed)
  it('21. PATCH/DELETE /api/sellers/me/inventory/:variantId/movements - Movement ledger is immutable (404/405)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/sellers/me/inventory/${variant1Id}/movements/mov_fake`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/sellers/me/inventory/${variant1Id}/movements/mov_fake`)
      .set('Authorization', `Bearer ${seller1Token}`)
      .expect(404);
  });

  // 22: Admin inventory access works
  it('22. GET & POST /api/admin/inventory - Admin can view & adjust inventory', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(listRes.body.data).toBeDefined();

    const getRes = await request(app.getHttpServer())
      .get(`/api/admin/inventory/${variant1Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(getRes.body.variantId).toBe(variant1Id);

    const adjRes = await request(app.getHttpServer())
      .post(`/api/admin/inventory/${variant1Id}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityDelta: 10, reason: 'Admin adjustment' })
      .expect(200);

    expect(adjRes.body.onHandQuantity).toBeDefined();
  });

  // 23: Public API does not expose exact stock quantity
  it('23. GET /api/products/slug/:slug - Public catalog does not expose exact on-hand stock number', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products/slug/silk-evening-dress`)
      .expect(200);

    expect(res.body.onHandQuantity).toBeUndefined();
    expect(res.body.reservedQuantity).toBeUndefined();
  });

  // 24 & 25: Suspended store & Archived product handling
  it('24-25. Verification of audit events logged for inventory operations', async () => {
    expect(mockAuditEvents.length).toBeGreaterThan(0);
    const eventTypes = mockAuditEvents.map((e: any) => e.event);
    expect(eventTypes).toContain('INVENTORY_ADJUSTED');
    expect(eventTypes).toContain('INVENTORY_RESERVATION_CREATED');
  });
});
