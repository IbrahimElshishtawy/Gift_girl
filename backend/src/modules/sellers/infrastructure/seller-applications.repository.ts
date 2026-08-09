import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SellerApplication, Prisma, SellerApplicationStatus } from '@prisma/client';

@Injectable()
export class SellerApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SellerApplication | null> {
    return this.prisma.sellerApplication.findUnique({ where: { id } });
  }

  async findLatestByUserId(userId: string): Promise<SellerApplication | null> {
    return this.prisma.sellerApplication.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.SellerApplicationCreateInput): Promise<SellerApplication> {
    return this.prisma.sellerApplication.create({ data });
  }

  async update(id: string, data: Prisma.SellerApplicationUpdateInput): Promise<SellerApplication> {
    return this.prisma.sellerApplication.update({ where: { id }, data });
  }

  async updateStatus(
    id: string,
    status: SellerApplicationStatus,
    reviewedByUserId?: string,
    rejectionReason?: string,
  ): Promise<SellerApplication> {
    return this.prisma.sellerApplication.update({
      where: { id },
      data: {
        status,
        reviewedByUserId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });
  }
}
