import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { InventoryReservationEntity } from '../domain/inventory-reservation.entity';
import { InventoryEntity } from '../domain/inventory.entity';
import { CreateReservationDto } from '../presentation/dto/create-reservation.dto';
import {
  InventoryMovementType,
  InventoryStatus,
  ReservationStatus,
  SecurityEventType,
} from '@prisma/client';

@Injectable()
export class InventoryReservationService {
  private readonly logger = new Logger(InventoryReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async createReservation(
    actorUserId: string,
    dto: CreateReservationDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<InventoryReservationEntity> {
    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.inventoryRepository.findReservationByIdempotencyKey(
        dto.idempotencyKey,
      );
      if (existing) {
        return InventoryReservationEntity.fromPrisma(existing);
      }
    }

    const inventoryRecord = await this.inventoryRepository.findByVariantId(dto.variantId);
    if (!inventoryRecord) {
      throw new NotFoundException(`Inventory for variant '${dto.variantId}' not found.`);
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const lockedInventory = await this.inventoryRepository.findByVariantIdWithLock(
        tx,
        dto.variantId,
      );
      if (!lockedInventory) {
        throw new NotFoundException(`Inventory for variant '${dto.variantId}' not found.`);
      }

      const available = InventoryEntity.calculateAvailable(
        lockedInventory.onHandQuantity,
        lockedInventory.reservedQuantity,
      );

      if (available < dto.quantity) {
        throw new ConflictException(
          `Insufficient stock available for reservation. Requested: ${dto.quantity}, Available: ${available}.`,
        );
      }

      const newReserved = lockedInventory.reservedQuantity + dto.quantity;
      const newAvailable = lockedInventory.onHandQuantity - newReserved;
      const newStatus = InventoryEntity.calculateStatus(
        newAvailable,
        lockedInventory.lowStockThreshold,
      );

      await this.inventoryRepository.updateInventory(
        lockedInventory.id,
        {
          reservedQuantity: newReserved,
          status: newStatus,
        },
        tx,
      );

      const ttlSeconds = dto.ttlSeconds || 900; // 15 mins default
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const createdReservation = await this.inventoryRepository.createReservation(
        {
          inventory: { connect: { id: lockedInventory.id } },
          quantity: dto.quantity,
          status: ReservationStatus.ACTIVE,
          expiresAt,
          referenceType: dto.referenceType?.trim() || null,
          referenceId: dto.referenceId?.trim() || null,
          idempotencyKey: dto.idempotencyKey?.trim() || null,
          createdBy: actorUserId,
        },
        tx,
      );

      await this.inventoryRepository.createMovement(
        {
          inventory: { connect: { id: lockedInventory.id } },
          type: InventoryMovementType.RESERVATION,
          quantity: dto.quantity,
          beforeQuantity: lockedInventory.onHandQuantity,
          afterQuantity: lockedInventory.onHandQuantity,
          reason: `Stock reservation created for ${dto.quantity} items`,
          referenceType: dto.referenceType?.trim() || null,
          referenceId: dto.referenceId?.trim() || null,
          idempotencyKey: dto.idempotencyKey ? `m_res_${dto.idempotencyKey}` : null,
          performedBy: actorUserId,
        },
        tx,
      );

      return createdReservation;
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.INVENTORY_RESERVATION_CREATED,
      actorUserId,
      ipAddress,
      userAgent,
      {
        reservationId: reservation.id,
        inventoryId: reservation.inventoryId,
        quantity: reservation.quantity,
        expiresAt: reservation.expiresAt,
      },
    );

    return InventoryReservationEntity.fromPrisma(reservation);
  }

  async releaseReservation(
    actorUserId: string,
    reservationId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<InventoryReservationEntity> {
    const reservationRecord = await this.inventoryRepository.findReservationById(reservationId);
    if (!reservationRecord) {
      throw new NotFoundException(`Reservation '${reservationId}' not found.`);
    }

    // Idempotency: if already released, return immediately
    if (reservationRecord.status === ReservationStatus.RELEASED) {
      return InventoryReservationEntity.fromPrisma(reservationRecord);
    }

    if (reservationRecord.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        `Reservation cannot be released from status '${reservationRecord.status}'.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const lockedReservation = await this.inventoryRepository.findReservationByIdWithLock(
        tx,
        reservationId,
      );
      if (!lockedReservation) {
        throw new NotFoundException(`Reservation '${reservationId}' not found.`);
      }

      if (lockedReservation.status === ReservationStatus.RELEASED) {
        return lockedReservation;
      }

      const lockedInventory = await this.inventoryRepository.findByIdWithLock(
        tx,
        lockedReservation.inventoryId,
      );
      if (!lockedInventory) {
        throw new NotFoundException(`Associated inventory not found.`);
      }

      const newReserved = Math.max(0, lockedInventory.reservedQuantity - lockedReservation.quantity);
      const newAvailable = InventoryEntity.calculateAvailable(
        lockedInventory.onHandQuantity,
        newReserved,
      );
      const newStatus = InventoryEntity.calculateStatus(
        newAvailable,
        lockedInventory.lowStockThreshold,
      );

      await this.inventoryRepository.updateInventory(
        lockedInventory.id,
        {
          reservedQuantity: newReserved,
          status: newStatus,
        },
        tx,
      );

      const relRes = await this.inventoryRepository.updateReservation(
        reservationId,
        {
          status: ReservationStatus.RELEASED,
          releasedAt: new Date(),
        },
        tx,
      );

      await this.inventoryRepository.createMovement(
        {
          inventory: { connect: { id: lockedInventory.id } },
          type: InventoryMovementType.RELEASE,
          quantity: -lockedReservation.quantity,
          beforeQuantity: lockedInventory.onHandQuantity,
          afterQuantity: lockedInventory.onHandQuantity,
          reason: `Stock reservation released for ${lockedReservation.quantity} items`,
          referenceType: lockedReservation.referenceType,
          referenceId: lockedReservation.referenceId,
          performedBy: actorUserId,
        },
        tx,
      );

      return relRes;
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.INVENTORY_RESERVATION_RELEASED,
      actorUserId,
      ipAddress,
      userAgent,
      { reservationId: updated.id, inventoryId: updated.inventoryId, quantity: updated.quantity },
    );

    return InventoryReservationEntity.fromPrisma(updated);
  }

  async consumeReservation(
    actorUserId: string,
    reservationId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<InventoryReservationEntity> {
    const reservationRecord = await this.inventoryRepository.findReservationById(reservationId);
    if (!reservationRecord) {
      throw new NotFoundException(`Reservation '${reservationId}' not found.`);
    }

    // Idempotency: if already consumed, return immediately
    if (reservationRecord.status === ReservationStatus.CONSUMED) {
      return InventoryReservationEntity.fromPrisma(reservationRecord);
    }

    if (reservationRecord.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        `Reservation cannot be consumed from status '${reservationRecord.status}'.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const lockedReservation = await this.inventoryRepository.findReservationByIdWithLock(
        tx,
        reservationId,
      );
      if (!lockedReservation) {
        throw new NotFoundException(`Reservation '${reservationId}' not found.`);
      }

      if (lockedReservation.status === ReservationStatus.CONSUMED) {
        return lockedReservation;
      }

      const lockedInventory = await this.inventoryRepository.findByIdWithLock(
        tx,
        lockedReservation.inventoryId,
      );
      if (!lockedInventory) {
        throw new NotFoundException(`Associated inventory not found.`);
      }

      const newReserved = Math.max(0, lockedInventory.reservedQuantity - lockedReservation.quantity);
      const newOnHand = Math.max(0, lockedInventory.onHandQuantity - lockedReservation.quantity);
      const newAvailable = InventoryEntity.calculateAvailable(newOnHand, newReserved);
      const newStatus = InventoryEntity.calculateStatus(
        newAvailable,
        lockedInventory.lowStockThreshold,
      );

      await this.inventoryRepository.updateInventory(
        lockedInventory.id,
        {
          onHandQuantity: newOnHand,
          reservedQuantity: newReserved,
          status: newStatus,
        },
        tx,
      );

      const conRes = await this.inventoryRepository.updateReservation(
        reservationId,
        {
          status: ReservationStatus.CONSUMED,
          consumedAt: new Date(),
        },
        tx,
      );

      await this.inventoryRepository.createMovement(
        {
          inventory: { connect: { id: lockedInventory.id } },
          type: InventoryMovementType.SALE,
          quantity: -lockedReservation.quantity,
          beforeQuantity: lockedInventory.onHandQuantity,
          afterQuantity: newOnHand,
          reason: `Stock reservation consumed (purchased) for ${lockedReservation.quantity} items`,
          referenceType: lockedReservation.referenceType,
          referenceId: lockedReservation.referenceId,
          performedBy: actorUserId,
        },
        tx,
      );

      return conRes;
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.INVENTORY_RESERVATION_CONSUMED,
      actorUserId,
      ipAddress,
      userAgent,
      { reservationId: updated.id, inventoryId: updated.inventoryId, quantity: updated.quantity },
    );

    return InventoryReservationEntity.fromPrisma(updated);
  }

  async expireReservations(): Promise<number> {
    const expiredList = await this.inventoryRepository.findActiveExpiredReservations(
      new Date(),
      100,
    );

    let expiredCount = 0;
    for (const res of expiredList) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const lockedRes = await this.inventoryRepository.findReservationByIdWithLock(tx, res.id);
          if (!lockedRes || lockedRes.status !== ReservationStatus.ACTIVE) return;

          const lockedInv = await this.inventoryRepository.findByIdWithLock(
            tx,
            lockedRes.inventoryId,
          );
          if (!lockedInv) return;

          const newReserved = Math.max(0, lockedInv.reservedQuantity - lockedRes.quantity);
          const newAvailable = InventoryEntity.calculateAvailable(
            lockedInv.onHandQuantity,
            newReserved,
          );
          const newStatus = InventoryEntity.calculateStatus(
            newAvailable,
            lockedInv.lowStockThreshold,
          );

          await this.inventoryRepository.updateInventory(
            lockedInv.id,
            {
              reservedQuantity: newReserved,
              status: newStatus,
            },
            tx,
          );

          await this.inventoryRepository.updateReservation(
            res.id,
            {
              status: ReservationStatus.EXPIRED,
            },
            tx,
          );

          await this.inventoryRepository.createMovement(
            {
              inventory: { connect: { id: lockedInv.id } },
              type: InventoryMovementType.RELEASE,
              quantity: -lockedRes.quantity,
              beforeQuantity: lockedInv.onHandQuantity,
              afterQuantity: lockedInv.onHandQuantity,
              reason: `Reservation expired (TTL reached) and released ${lockedRes.quantity} items`,
              referenceType: lockedRes.referenceType,
              referenceId: lockedRes.referenceId,
              performedBy: 'SYSTEM_EXPIRATION_WORKER',
            },
            tx,
          );

          expiredCount++;
        });

        await this.securityAuditService.logEvent(
          SecurityEventType.INVENTORY_RESERVATION_EXPIRED,
          'SYSTEM_EXPIRATION_WORKER',
          undefined,
          undefined,
          { reservationId: res.id, inventoryId: res.inventoryId },
        );
      } catch (err) {
        this.logger.error(`Failed to expire reservation ${res.id}:`, err);
      }
    }

    return expiredCount;
  }
}
