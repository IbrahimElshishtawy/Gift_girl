import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SellersRepository } from '../infrastructure/sellers.repository';
import { SellerStaffRepository } from '../infrastructure/seller-staff.repository';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SellerEntity } from '../domain/seller.entity';
import { SellerStaffEntity } from '../domain/seller-staff.entity';
import { SellerStatus, SellerStaffStatus, SecurityEventType, Prisma } from '@prisma/client';

export interface UpdateSellerProfileData {
  businessName?: string;
  legalName?: string;
  description?: string;
  phone?: string;
  email?: string;
  country?: string;
  governorateState?: string;
  city?: string;
  address?: string;
}

@Injectable()
export class SellersService {
  constructor(
    private readonly sellersRepository: SellersRepository,
    private readonly staffRepository: SellerStaffRepository,
    private readonly prisma: PrismaService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getSellerByUserId(userId: string): Promise<SellerEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundException('Seller profile not found for this user.');
    }
    return SellerEntity.fromPrisma(seller);
  }

  async getSellerById(id: string): Promise<SellerEntity> {
    const seller = await this.sellersRepository.findById(id);
    if (!seller) {
      throw new NotFoundException('Seller not found.');
    }
    return SellerEntity.fromPrisma(seller);
  }

  async updateSellerProfile(
    userId: string,
    data: UpdateSellerProfileData,
  ): Promise<SellerEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundException('Seller profile not found for this user.');
    }

    if (seller.status !== SellerStatus.ACTIVE && seller.status !== SellerStatus.PENDING) {
      throw new ForbiddenException(
        `Seller profile cannot be updated while in status '${seller.status}'.`,
      );
    }

    const updated = await this.sellersRepository.update(seller.id, data);
    return SellerEntity.fromPrisma(updated);
  }

  async listSellersAdmin(params: {
    page?: number;
    limit?: number;
    status?: SellerStatus;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SellerWhereInput = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.OR = [
        { businessName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { items, total } = await this.sellersRepository.findMany({
      skip,
      take: limit,
      where,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(SellerEntity.fromPrisma),
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

  async updateSellerStatus(
    adminUserId: string,
    sellerId: string,
    newStatus: SellerStatus,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SellerEntity> {
    const seller = await this.sellersRepository.findById(sellerId);
    if (!seller) throw new NotFoundException('Seller not found.');

    const updated = await this.sellersRepository.updateStatus(sellerId, newStatus, reason);

    const eventMap: Record<SellerStatus, SecurityEventType> = {
      [SellerStatus.ACTIVE]: SecurityEventType.SELLER_ACTIVATED,
      [SellerStatus.SUSPENDED]: SecurityEventType.SELLER_SUSPENDED,
      [SellerStatus.DISABLED]: SecurityEventType.SELLER_DISABLED,
      [SellerStatus.REJECTED]: SecurityEventType.SELLER_REJECTED,
      [SellerStatus.PENDING]: SecurityEventType.SELLER_APPLICATION_UPDATED,
    };

    await this.securityAuditService.logEvent(
      eventMap[newStatus],
      adminUserId,
      ipAddress,
      userAgent,
      { sellerId, previousStatus: seller.status, newStatus, reason },
    );

    return SellerEntity.fromPrisma(updated);
  }

  // Seller Staff Management
  async getStaffForSeller(userId: string): Promise<SellerStaffEntity[]> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundException('Seller profile not found for this user.');
    }

    const staffList = await this.staffRepository.findBySellerId(seller.id);
    return staffList.map(SellerStaffEntity.fromPrisma);
  }

  async addStaffMember(
    userId: string,
    targetStaffUserId: string,
    role: string = 'STAFF',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SellerStaffEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new NotFoundException('Seller profile not found for this user.');
    }

    if (seller.status !== SellerStatus.ACTIVE) {
      throw new ForbiddenException('Only active sellers can add staff members.');
    }

    const staffUser = await this.prisma.user.findUnique({ where: { id: targetStaffUserId } });
    if (!staffUser) {
      throw new NotFoundException('Target staff user identity not found.');
    }

    const existingStaff = await this.staffRepository.findBySellerAndUser(
      seller.id,
      targetStaffUserId,
    );
    if (existingStaff) {
      throw new ConflictException('User is already assigned as a staff member for this seller.');
    }

    const staff = await this.staffRepository.create({
      seller: { connect: { id: seller.id } },
      user: { connect: { id: targetStaffUserId } },
      role,
      status: SellerStaffStatus.ACTIVE,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.SELLER_STAFF_ADDED,
      userId,
      ipAddress,
      userAgent,
      { sellerId: seller.id, staffUserId: targetStaffUserId, role },
    );

    return SellerStaffEntity.fromPrisma(staff);
  }

  async updateStaffStatus(
    userId: string,
    staffId: string,
    status: SellerStaffStatus,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SellerStaffEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundException('Seller profile not found.');

    const staff = await this.staffRepository.findById(staffId);
    if (!staff) throw new NotFoundException('Staff record not found.');

    if (staff.sellerId !== seller.id) {
      throw new ForbiddenException('Ownership protection: You cannot modify another seller staff member.');
    }

    const updated = await this.staffRepository.updateStatus(staffId, status);

    await this.securityAuditService.logEvent(
      SecurityEventType.SELLER_STAFF_UPDATED,
      userId,
      ipAddress,
      userAgent,
      { sellerId: seller.id, staffId, status },
    );

    return SellerStaffEntity.fromPrisma(updated);
  }

  async removeStaffMember(
    userId: string,
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) throw new NotFoundException('Seller profile not found.');

    const staff = await this.staffRepository.findById(staffId);
    if (!staff) throw new NotFoundException('Staff record not found.');

    if (staff.sellerId !== seller.id) {
      throw new ForbiddenException('Ownership protection: You cannot remove another seller staff member.');
    }

    await this.staffRepository.delete(staffId);

    await this.securityAuditService.logEvent(
      SecurityEventType.SELLER_STAFF_REMOVED,
      userId,
      ipAddress,
      userAgent,
      { sellerId: seller.id, staffId },
    );
  }
}
