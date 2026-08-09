import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Seller, Prisma, SellerStatus, SellerVerificationStatus } from '@prisma/client';

@Injectable()
export class SellersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Seller | null> {
    return this.prisma.seller.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Seller | null> {
    return this.prisma.seller.findUnique({ where: { userId } });
  }

  async create(data: Prisma.SellerCreateInput): Promise<Seller> {
    return this.prisma.seller.create({ data });
  }

  async update(id: string, data: Prisma.SellerUpdateInput): Promise<Seller> {
    return this.prisma.seller.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: SellerStatus, rejectionReason?: string): Promise<Seller> {
    const data: Prisma.SellerUpdateInput = {
      status,
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(status === SellerStatus.ACTIVE ? { approvedAt: new Date() } : {}),
      ...(status === SellerStatus.SUSPENDED ? { suspendedAt: new Date() } : {}),
    };
    return this.prisma.seller.update({ where: { id }, data });
  }

  async updateVerificationStatus(
    id: string,
    verificationStatus: SellerVerificationStatus,
  ): Promise<Seller> {
    return this.prisma.seller.update({
      where: { id },
      data: { verificationStatus },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.SellerWhereInput;
    orderBy?: Prisma.SellerOrderByWithRelationInput;
  }): Promise<{ items: Seller[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.seller.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy || { createdAt: 'desc' },
      }),
      this.prisma.seller.count({ where: params.where }),
    ]);

    return { items, total };
  }
}
