import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  Inventory,
  InventoryMovement,
  InventoryReservation,
  InventoryStatus,
  ReservationStatus,
  Prisma,
} from '@prisma/client';

export type InventoryWithVariantAndStore = Inventory & {
  variant: {
    id: string;
    sku: string;
    productId: string;
    product: {
      id: string;
      name: string;
      storeId: string;
      status: string;
    };
  };
};

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVariantId(variantId: string): Promise<InventoryWithVariantAndStore | null> {
    return this.prisma.inventory.findUnique({
      where: { variantId },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                storeId: true,
                status: true,
              },
            },
          },
        },
      },
    }) as Promise<InventoryWithVariantAndStore | null>;
  }

  async findById(id: string): Promise<InventoryWithVariantAndStore | null> {
    return this.prisma.inventory.findUnique({
      where: { id },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                storeId: true,
                status: true,
              },
            },
          },
        },
      },
    }) as Promise<InventoryWithVariantAndStore | null>;
  }

  async findByVariantIdWithLock(
    tx: Prisma.TransactionClient,
    variantId: string,
  ): Promise<Inventory | null> {
    // In PostgreSQL, execute FOR UPDATE to acquire pessimistic row lock
    const inventories = await tx.$queryRaw<Inventory[]>`
      SELECT * FROM "inventories"
      WHERE "variantId" = ${variantId}
      FOR UPDATE
    `;
    return inventories && inventories.length > 0 ? inventories[0] : null;
  }

  async findByIdWithLock(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<Inventory | null> {
    const inventories = await tx.$queryRaw<Inventory[]>`
      SELECT * FROM "inventories"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
    return inventories && inventories.length > 0 ? inventories[0] : null;
  }

  async createInventory(
    variantId: string,
    initialOnHand = 0,
    lowStockThreshold = 10,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const client = tx || this.prisma;
    const available = Math.max(0, initialOnHand);
    let status: InventoryStatus = InventoryStatus.OUT_OF_STOCK;

    if (available > 0) {
      status = available <= lowStockThreshold ? InventoryStatus.LOW_STOCK : InventoryStatus.IN_STOCK;
    }

    return client.inventory.create({
      data: {
        variantId,
        onHandQuantity: initialOnHand,
        reservedQuantity: 0,
        lowStockThreshold,
        status,
      },
    });
  }

  async updateInventory(
    id: string,
    data: Prisma.InventoryUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Inventory> {
    const client = tx || this.prisma;
    return client.inventory.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  }

  async createMovement(
    data: Prisma.InventoryMovementCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryMovement> {
    const client = tx || this.prisma;
    return client.inventoryMovement.create({
      data,
    });
  }

  async findMovementByIdempotencyKey(key: string): Promise<InventoryMovement | null> {
    return this.prisma.inventoryMovement.findUnique({
      where: { idempotencyKey: key },
    });
  }

  async createReservation(
    data: Prisma.InventoryReservationCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryReservation> {
    const client = tx || this.prisma;
    return client.inventoryReservation.create({
      data,
    });
  }

  async findReservationById(id: string): Promise<InventoryReservation | null> {
    return this.prisma.inventoryReservation.findUnique({
      where: { id },
    });
  }

  async findReservationByIdWithLock(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<InventoryReservation | null> {
    const reservations = await tx.$queryRaw<InventoryReservation[]>`
      SELECT * FROM "inventory_reservations"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
    return reservations && reservations.length > 0 ? reservations[0] : null;
  }

  async findReservationByIdempotencyKey(key: string): Promise<InventoryReservation | null> {
    return this.prisma.inventoryReservation.findUnique({
      where: { idempotencyKey: key },
    });
  }

  async updateReservation(
    id: string,
    data: Prisma.InventoryReservationUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryReservation> {
    const client = tx || this.prisma;
    return client.inventoryReservation.update({
      where: { id },
      data,
    });
  }

  async findActiveExpiredReservations(
    now = new Date(),
    limit = 100,
  ): Promise<InventoryReservation[]> {
    return this.prisma.inventoryReservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });
  }

  async findManySellerInventory(
    storeId: string,
    params: {
      skip: number;
      take: number;
      status?: InventoryStatus;
      search?: string;
    },
  ): Promise<{ items: InventoryWithVariantAndStore[]; total: number }> {
    const where: Prisma.InventoryWhereInput = {
      variant: {
        product: {
          storeId,
        },
      },
    };

    if (params.status) {
      where.status = params.status;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.variant = {
        product: {
          storeId,
        },
        OR: [
          { sku: { contains: term, mode: 'insensitive' } },
          { product: { name: { contains: term, mode: 'insensitive' } } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        skip: params.skip,
        take: params.take,
        where,
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              productId: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  storeId: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }) as Promise<InventoryWithVariantAndStore[]>,
      this.prisma.inventory.count({ where }),
    ]);

    return { items, total };
  }

  async findManyAdminInventory(params: {
    skip: number;
    take: number;
    storeId?: string;
    status?: InventoryStatus;
    search?: string;
  }): Promise<{ items: InventoryWithVariantAndStore[]; total: number }> {
    const where: Prisma.InventoryWhereInput = {};

    if (params.storeId) {
      where.variant = {
        product: {
          storeId: params.storeId,
        },
      };
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.variant = {
        ...(params.storeId ? { product: { storeId: params.storeId } } : {}),
        OR: [
          { sku: { contains: term, mode: 'insensitive' } },
          { product: { name: { contains: term, mode: 'insensitive' } } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        skip: params.skip,
        take: params.take,
        where,
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              productId: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  storeId: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }) as Promise<InventoryWithVariantAndStore[]>,
      this.prisma.inventory.count({ where }),
    ]);

    return { items, total };
  }

  async findMovements(
    inventoryId: string,
    skip = 0,
    take = 50,
  ): Promise<{ items: InventoryMovement[]; total: number }> {
    const where = { inventoryId };
    const [items, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { items, total };
  }
}
