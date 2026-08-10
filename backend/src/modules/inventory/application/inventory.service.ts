import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { StoresRepository } from '../../sellers/infrastructure/stores.repository';
import { SellersRepository } from '../../sellers/infrastructure/sellers.repository';
import { InventoryEntity } from '../domain/inventory.entity';
import { InventoryMovementEntity } from '../domain/inventory-movement.entity';
import { AdjustInventoryDto } from '../presentation/dto/adjust-inventory.dto';
import { UpdateInventorySettingsDto } from '../presentation/dto/update-inventory-settings.dto';
import { SellerInventoryQueryDto } from '../presentation/dto/seller-inventory-query.dto';
import { AdminInventoryQueryDto } from '../presentation/dto/admin-inventory-query.dto';
import {
  InventoryMovementType,
  InventoryStatus,
  SecurityEventType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly securityAuditService: SecurityAuditService,
    private readonly storesRepository: StoresRepository,
    private readonly sellersRepository: SellersRepository,
  ) {}

  /**
   * Helper to verify seller ownership of a store & variant
   */
  async verifySellerOwnership(userId: string, variantId: string): Promise<string> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new ForbiddenException('Only registered sellers can manage inventory.');
    }

    const store = await this.storesRepository.findBySellerId(seller.id);
    if (!store) {
      throw new ForbiddenException('No store found for authenticated seller.');
    }

    const inventory = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventory) {
      throw new NotFoundException(`Inventory for variant '${variantId}' not found.`);
    }

    if (inventory.variant.product.storeId !== store.id) {
      throw new NotFoundException(`Inventory for variant '${variantId}' not found in your store.`);
    }

    return store.id;
  }

  async initializeInventory(
    variantId: string,
    initialOnHand = 0,
    lowStockThreshold = 10,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryEntity> {
    const existing = await this.inventoryRepository.findByVariantId(variantId);
    if (existing) {
      return InventoryEntity.fromPrisma(existing);
    }

    const inventory = await this.inventoryRepository.createInventory(
      variantId,
      initialOnHand,
      lowStockThreshold,
      tx,
    );

    return InventoryEntity.fromPrisma(inventory);
  }

  async adjustStock(
    actorUserId: string,
    variantId: string,
    dto: AdjustInventoryDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<InventoryEntity> {
    // Check idempotency if key is provided
    if (dto.idempotencyKey) {
      const existingMovement = await this.inventoryRepository.findMovementByIdempotencyKey(
        dto.idempotencyKey,
      );
      if (existingMovement) {
        const inventory = await this.inventoryRepository.findById(existingMovement.inventoryId);
        return InventoryEntity.fromPrisma(inventory!);
      }
    }

    const inventoryRecord = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventoryRecord) {
      throw new NotFoundException(`Inventory for variant '${variantId}' not found.`);
    }

    // Execute atomic update inside transaction with pessimistic row locking
    const updatedInventory = await this.prisma.$transaction(async (tx) => {
      const lockedInventory = await this.inventoryRepository.findByVariantIdWithLock(
        tx,
        variantId,
      );
      if (!lockedInventory) {
        throw new NotFoundException(`Inventory for variant '${variantId}' not found.`);
      }

      const currentOnHand = lockedInventory.onHandQuantity;
      const currentReserved = lockedInventory.reservedQuantity;
      const newOnHand = currentOnHand + dto.quantityDelta;

      if (newOnHand < 0) {
        throw new BadRequestException(
          `Insufficient stock. Current on-hand quantity (${currentOnHand}) cannot be reduced by ${Math.abs(dto.quantityDelta)}.`,
        );
      }

      const newAvailable = InventoryEntity.calculateAvailable(newOnHand, currentReserved);
      const newStatus = InventoryEntity.calculateStatus(
        newAvailable,
        lockedInventory.lowStockThreshold,
      );

      // Determine movement type if not provided
      let mType = dto.movementType;
      if (!mType) {
        mType = dto.quantityDelta >= 0 ? InventoryMovementType.STOCK_IN : InventoryMovementType.STOCK_OUT;
      }

      const updated = await this.inventoryRepository.updateInventory(
        lockedInventory.id,
        {
          onHandQuantity: newOnHand,
          status: newStatus,
        },
        tx,
      );

      await this.inventoryRepository.createMovement(
        {
          inventory: { connect: { id: lockedInventory.id } },
          type: mType,
          quantity: dto.quantityDelta,
          beforeQuantity: currentOnHand,
          afterQuantity: newOnHand,
          reason: dto.reason?.trim() || null,
          referenceType: dto.referenceType?.trim() || null,
          referenceId: dto.referenceId?.trim() || null,
          idempotencyKey: dto.idempotencyKey?.trim() || null,
          performedBy: actorUserId,
        },
        tx,
      );

      return updated;
    });

    // Security audit logging
    await this.securityAuditService.logEvent(
      SecurityEventType.INVENTORY_ADJUSTED,
      actorUserId,
      ipAddress,
      userAgent,
      {
        inventoryId: updatedInventory.id,
        variantId,
        delta: dto.quantityDelta,
        newOnHand: updatedInventory.onHandQuantity,
        newStatus: updatedInventory.status,
      },
    );

    if (updatedInventory.status === InventoryStatus.LOW_STOCK) {
      await this.securityAuditService.logEvent(
        SecurityEventType.INVENTORY_LOW_STOCK,
        actorUserId,
        ipAddress,
        userAgent,
        { inventoryId: updatedInventory.id, variantId },
      );
    } else if (updatedInventory.status === InventoryStatus.OUT_OF_STOCK) {
      await this.securityAuditService.logEvent(
        SecurityEventType.INVENTORY_STOCK_OUT,
        actorUserId,
        ipAddress,
        userAgent,
        { inventoryId: updatedInventory.id, variantId },
      );
    }

    const full = await this.inventoryRepository.findById(updatedInventory.id);
    return InventoryEntity.fromPrisma(full!);
  }

  async updateInventorySettings(
    actorUserId: string,
    variantId: string,
    dto: UpdateInventorySettingsDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<InventoryEntity> {
    const inventoryRecord = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventoryRecord) {
      throw new NotFoundException(`Inventory for variant '${variantId}' not found.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const locked = await this.inventoryRepository.findByVariantIdWithLock(tx, variantId);
      if (!locked) throw new NotFoundException(`Inventory for variant '${variantId}' not found.`);

      const threshold =
        dto.lowStockThreshold !== undefined
          ? dto.lowStockThreshold
          : locked.lowStockThreshold;

      const available = InventoryEntity.calculateAvailable(
        locked.onHandQuantity,
        locked.reservedQuantity,
      );
      const newStatus = InventoryEntity.calculateStatus(available, threshold);

      return this.inventoryRepository.updateInventory(
        locked.id,
        {
          lowStockThreshold: threshold,
          status: newStatus,
        },
        tx,
      );
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.INVENTORY_SETTINGS_UPDATED,
      actorUserId,
      ipAddress,
      userAgent,
      { inventoryId: updated.id, variantId, lowStockThreshold: updated.lowStockThreshold },
    );

    const full = await this.inventoryRepository.findById(updated.id);
    return InventoryEntity.fromPrisma(full!);
  }

  async getInventoryByVariantId(variantId: string): Promise<InventoryEntity> {
    const inventory = await this.inventoryRepository.findByVariantId(variantId);
    if (!inventory) {
      throw new NotFoundException(`Inventory for variant '${variantId}' not found.`);
    }
    return InventoryEntity.fromPrisma(inventory);
  }

  async listSellerInventory(userId: string, params: SellerInventoryQueryDto) {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) throw new ForbiddenException('Only registered sellers can view inventory.');

    const store = await this.storesRepository.findBySellerId(seller.id);
    if (!store) throw new ForbiddenException('No store found for authenticated seller.');

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.inventoryRepository.findManySellerInventory(store.id, {
      skip,
      take: limit,
      status: params.status,
      search: params.search,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(InventoryEntity.fromPrisma),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async listAdminInventory(params: AdminInventoryQueryDto) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.inventoryRepository.findManyAdminInventory({
      skip,
      take: limit,
      storeId: params.storeId,
      status: params.status,
      search: params.search,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(InventoryEntity.fromPrisma),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getMovements(inventoryId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const { items, total } = await this.inventoryRepository.findMovements(inventoryId, skip, limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(InventoryMovementEntity.fromPrisma),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}
