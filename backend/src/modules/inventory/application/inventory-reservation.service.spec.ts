import { Test, TestingModule } from '@nestjs/testing';
import { InventoryReservationService } from './inventory-reservation.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { InventoryStatus, ReservationStatus } from '@prisma/client';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('InventoryReservationService', () => {
  let service: InventoryReservationService;
  let mockPrismaService: any;
  let mockInventoryRepository: any;
  let mockSecurityAuditService: any;

  const mockInventory = {
    id: 'inv_123',
    variantId: 'var_123',
    onHandQuantity: 100,
    reservedQuantity: 20, // Available = 80
    lowStockThreshold: 15,
    version: 1,
    status: InventoryStatus.IN_STOCK,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReservation = {
    id: 'res_123',
    inventoryId: 'inv_123',
    quantity: 10,
    status: ReservationStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 900000),
    referenceType: 'CART',
    referenceId: 'cart_1',
    idempotencyKey: null,
    createdBy: 'user_123',
    releasedAt: null,
    consumedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
    };

    mockInventoryRepository = {
      findByVariantId: jest.fn().mockResolvedValue(mockInventory),
      findById: jest.fn().mockResolvedValue(mockInventory),
      findByVariantIdWithLock: jest.fn().mockResolvedValue(mockInventory),
      findByIdWithLock: jest.fn().mockResolvedValue(mockInventory),
      updateInventory: jest.fn().mockResolvedValue(mockInventory),
      createReservation: jest.fn().mockResolvedValue(mockReservation),
      findReservationById: jest.fn().mockResolvedValue(mockReservation),
      findReservationByIdWithLock: jest.fn().mockResolvedValue(mockReservation),
      findReservationByIdempotencyKey: jest.fn().mockResolvedValue(null),
      updateReservation: jest.fn().mockResolvedValue(mockReservation),
      createMovement: jest.fn().mockResolvedValue({ id: 'mov_1' }),
      findActiveExpiredReservations: jest.fn().mockResolvedValue([]),
    };

    mockSecurityAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryReservationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InventoryRepository, useValue: mockInventoryRepository },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<InventoryReservationService>(InventoryReservationService);
  });

  it('should create reservation when sufficient available stock exists', async () => {
    const result = await service.createReservation('user_123', {
      variantId: 'var_123',
      quantity: 10,
    });

    expect(result.id).toBe('res_123');
    expect(mockInventoryRepository.updateInventory).toHaveBeenCalledWith(
      'inv_123',
      expect.objectContaining({ reservedQuantity: 30 }),
      mockPrismaService,
    );
  });

  it('should reject reservation when requested quantity exceeds available stock', async () => {
    await expect(
      service.createReservation('user_123', {
        variantId: 'var_123',
        quantity: 100, // Available is 80
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should safely release an active reservation', async () => {
    mockInventoryRepository.updateReservation.mockResolvedValueOnce({
      ...mockReservation,
      status: ReservationStatus.RELEASED,
      releasedAt: new Date(),
    });

    const result = await service.releaseReservation('user_123', 'res_123');

    expect(result.status).toBe(ReservationStatus.RELEASED);
    expect(mockInventoryRepository.updateInventory).toHaveBeenCalledWith(
      'inv_123',
      expect.objectContaining({ reservedQuantity: 10 }), // 20 - 10
      mockPrismaService,
    );
  });

  it('should return existing reservation on idempotent duplicate release', async () => {
    mockInventoryRepository.findReservationById.mockResolvedValueOnce({
      ...mockReservation,
      status: ReservationStatus.RELEASED,
    });

    const result = await service.releaseReservation('user_123', 'res_123');

    expect(result.status).toBe(ReservationStatus.RELEASED);
    expect(mockInventoryRepository.updateInventory).not.toHaveBeenCalled();
  });

  it('should consume an active reservation and update on-hand stock', async () => {
    mockInventoryRepository.updateReservation.mockResolvedValueOnce({
      ...mockReservation,
      status: ReservationStatus.CONSUMED,
      consumedAt: new Date(),
    });

    const result = await service.consumeReservation('user_123', 'res_123');

    expect(result.status).toBe(ReservationStatus.CONSUMED);
    expect(mockInventoryRepository.updateInventory).toHaveBeenCalledWith(
      'inv_123',
      expect.objectContaining({
        onHandQuantity: 90, // 100 - 10
        reservedQuantity: 10, // 20 - 10
      }),
      mockPrismaService,
    );
  });

  it('should expire active reservations safely and release stock', async () => {
    mockInventoryRepository.findActiveExpiredReservations.mockResolvedValueOnce([mockReservation]);

    const count = await service.expireReservations();

    expect(count).toBe(1);
    expect(mockInventoryRepository.updateReservation).toHaveBeenCalledWith(
      'res_123',
      expect.objectContaining({ status: ReservationStatus.EXPIRED }),
      mockPrismaService,
    );
  });
});
