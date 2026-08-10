import { Inventory, InventoryStatus } from '@prisma/client';

export class InventoryEntity {
  id!: string;
  variantId!: string;
  onHandQuantity!: number;
  reservedQuantity!: number;
  availableQuantity!: number;
  lowStockThreshold!: number;
  version!: number;
  status!: InventoryStatus;
  createdAt!: Date;
  updatedAt!: Date;

  static calculateAvailable(onHand: number, reserved: number): number {
    return Math.max(0, onHand - reserved);
  }

  static calculateStatus(available: number, threshold: number): InventoryStatus {
    if (available <= 0) {
      return InventoryStatus.OUT_OF_STOCK;
    }
    if (available <= threshold) {
      return InventoryStatus.LOW_STOCK;
    }
    return InventoryStatus.IN_STOCK;
  }

  static fromPrisma(prismaInventory: Inventory): InventoryEntity {
    const available = InventoryEntity.calculateAvailable(
      prismaInventory.onHandQuantity,
      prismaInventory.reservedQuantity,
    );

    const entity = new InventoryEntity();
    entity.id = prismaInventory.id;
    entity.variantId = prismaInventory.variantId;
    entity.onHandQuantity = prismaInventory.onHandQuantity;
    entity.reservedQuantity = prismaInventory.reservedQuantity;
    entity.availableQuantity = available;
    entity.lowStockThreshold = prismaInventory.lowStockThreshold;
    entity.version = prismaInventory.version;
    entity.status = prismaInventory.status;
    entity.createdAt = prismaInventory.createdAt;
    entity.updatedAt = prismaInventory.updatedAt;
    return entity;
  }
}
