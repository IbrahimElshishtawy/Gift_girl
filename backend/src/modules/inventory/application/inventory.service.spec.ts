import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { StoresRepository } from '../../sellers/infrastructure/stores.repository';
import { SellersRepository } from '../../sellers/infrastructure/sellers.repository';
import { InventoryStatus, InventoryMovementType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InventoryService', () => {
  let service: InventoryService;
  let mockPrismaService: any;
  let mockInventoryRepository: any;
  let mockSecurityAuditService: any;
  let mockStoresRepository: any;
  let mockSellersRepository: any;

  const mockInventory = {
    id: 'inv_123',
    variantId: 'var_123',
    onHandQuantity: 100,
    reservedQuantity: 20,
    lowStockThreshold: 15,
    version: 1,
    status: InventoryStatus.IN_STOCK,
    createdAt: new Date(),
    updatedAt: new Date(),
    variant: {
      id: 'var_123',
      sku: 'SKU-TEST-001',
      productId: 'prod_123',
      product: {
        id: 'prod_123',
        name: 'Test Product',
        storeId: 'store_123',
        status: 'PUBLISHED',
      },
    },
  };

  let currentInventory = { ...mockInventory };

  beforeEach(async () => {
    currentInventory = { ...mockInventory };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
    };

    mockInventoryRepository = {
      findByVariantId: jest.fn().mockImplementation(() => Promise.resolve(currentInventory)),
      findById: jest.fn().mockImplementation(() => Promise.resolve(currentInventory)),
      findByVariantIdWithLock: jest.fn().mockImplementation(() => Promise.resolve(currentInventory)),
      findByIdWithLock: jest.fn().mockImplementation(() => Promise.resolve(currentInventory)),
      createInventory: jest.fn().mockResolvedValue({
        id: 'inv_new',
        variantId: 'var_new',
        onHandQuantity: 0,
        reservedQuantity: 0,
        lowStockThreshold: 10,
        version: 1,
        status: InventoryStatus.OUT_OF_STOCK,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateInventory: jest.fn().mockImplementation((id, data) => {
        currentInventory = {
          ...currentInventory,
          ...data,
          version: currentInventory.version + 1,
        };
        return Promise.resolve(currentInventory);
      }),
      createMovement: jest.fn().mockResolvedValue({ id: 'mov_1' }),
      findMovementByIdempotencyKey: jest.fn().mockResolvedValue(null),
    };

    mockSecurityAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockStoresRepository = {
      findBySellerId: jest.fn().mockResolvedValue({ id: 'store_123' }),
    };

    mockSellersRepository = {
      findByUserId: jest.fn().mockResolvedValue({ id: 'seller_123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InventoryRepository, useValue: mockInventoryRepository },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
        { provide: StoresRepository, useValue: mockStoresRepository },
        { provide: SellersRepository, useValue: mockSellersRepository },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should initialize inventory with default 0 stock and OUT_OF_STOCK status', async () => {
    mockInventoryRepository.findByVariantId.mockResolvedValueOnce(null);

    const result = await service.initializeInventory('var_new');

    expect(result.onHandQuantity).toBe(0);
    expect(result.reservedQuantity).toBe(0);
    expect(result.availableQuantity).toBe(0);
    expect(result.status).toBe(InventoryStatus.OUT_OF_STOCK);
    expect(mockInventoryRepository.createInventory).toHaveBeenCalledWith(
      'var_new',
      0,
      10,
      undefined,
    );
  });

  it('should adjust stock quantity upwards successfully', async () => {
    const result = await service.adjustStock('user_123', 'var_123', {
      quantityDelta: 50,
      reason: 'Supplier restock',
    });

    expect(result.onHandQuantity).toBe(150);
    expect(mockInventoryRepository.updateInventory).toHaveBeenCalledWith(
      'inv_123',
      expect.objectContaining({ onHandQuantity: 150, status: InventoryStatus.IN_STOCK }),
      mockPrismaService,
    );
    expect(mockInventoryRepository.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InventoryMovementType.STOCK_IN,
        quantity: 50,
        beforeQuantity: 100,
        afterQuantity: 150,
      }),
      mockPrismaService,
    );
  });

  it('should reject stock adjustment that results in negative on-hand quantity', async () => {
    await expect(
      service.adjustStock('user_123', 'var_123', {
        quantityDelta: -150,
        reason: 'Damage',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return existing inventory on idempotent duplicate request', async () => {
    mockInventoryRepository.findMovementByIdempotencyKey.mockResolvedValueOnce({
      id: 'mov_existing',
      inventoryId: 'inv_123',
    });

    const result = await service.adjustStock('user_123', 'var_123', {
      quantityDelta: 50,
      idempotencyKey: 'idemp_key_123',
    });

    expect(result.id).toBe('inv_123');
    expect(mockInventoryRepository.updateInventory).not.toHaveBeenCalled();
  });

  it('should correctly calculate LOW_STOCK status when available stock drops below threshold', async () => {
    // Current onHand 100, reserved 20 (available 80). Adjust -70 -> onHand 30, available 10 <= threshold 15
    const result = await service.adjustStock('user_123', 'var_123', {
      quantityDelta: -70,
    });

    expect(mockInventoryRepository.updateInventory).toHaveBeenCalledWith(
      'inv_123',
      expect.objectContaining({ status: InventoryStatus.LOW_STOCK }),
      mockPrismaService,
    );
  });
});
