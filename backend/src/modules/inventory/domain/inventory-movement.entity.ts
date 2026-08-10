import { InventoryMovement, InventoryMovementType } from '@prisma/client';

export class InventoryMovementEntity {
  id!: string;
  inventoryId!: string;
  type!: InventoryMovementType;
  quantity!: number;
  beforeQuantity!: number;
  afterQuantity!: number;
  reason!: string | null;
  referenceType!: string | null;
  referenceId!: string | null;
  idempotencyKey!: string | null;
  performedBy!: string | null;
  createdAt!: Date;

  static fromPrisma(prismaMovement: InventoryMovement): InventoryMovementEntity {
    const entity = new InventoryMovementEntity();
    entity.id = prismaMovement.id;
    entity.inventoryId = prismaMovement.inventoryId;
    entity.type = prismaMovement.type;
    entity.quantity = prismaMovement.quantity;
    entity.beforeQuantity = prismaMovement.beforeQuantity;
    entity.afterQuantity = prismaMovement.afterQuantity;
    entity.reason = prismaMovement.reason;
    entity.referenceType = prismaMovement.referenceType;
    entity.referenceId = prismaMovement.referenceId;
    entity.idempotencyKey = prismaMovement.idempotencyKey;
    entity.performedBy = prismaMovement.performedBy;
    entity.createdAt = prismaMovement.createdAt;
    return entity;
  }
}
