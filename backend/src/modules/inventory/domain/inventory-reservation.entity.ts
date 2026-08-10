import { InventoryReservation, ReservationStatus } from '@prisma/client';

export class InventoryReservationEntity {
  id!: string;
  inventoryId!: string;
  quantity!: number;
  status!: ReservationStatus;
  expiresAt!: Date;
  referenceType!: string | null;
  referenceId!: string | null;
  idempotencyKey!: string | null;
  createdBy!: string | null;
  releasedAt!: Date | null;
  consumedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromPrisma(prismaReservation: InventoryReservation): InventoryReservationEntity {
    const entity = new InventoryReservationEntity();
    entity.id = prismaReservation.id;
    entity.inventoryId = prismaReservation.inventoryId;
    entity.quantity = prismaReservation.quantity;
    entity.status = prismaReservation.status;
    entity.expiresAt = prismaReservation.expiresAt;
    entity.referenceType = prismaReservation.referenceType;
    entity.referenceId = prismaReservation.referenceId;
    entity.idempotencyKey = prismaReservation.idempotencyKey;
    entity.createdBy = prismaReservation.createdBy;
    entity.releasedAt = prismaReservation.releasedAt;
    entity.consumedAt = prismaReservation.consumedAt;
    entity.createdAt = prismaReservation.createdAt;
    entity.updatedAt = prismaReservation.updatedAt;
    return entity;
  }
}
