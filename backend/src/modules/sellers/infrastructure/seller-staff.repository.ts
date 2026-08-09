import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SellerStaff, Prisma, SellerStaffStatus } from '@prisma/client';

@Injectable()
export class SellerStaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SellerStaff | null> {
    return this.prisma.sellerStaff.findUnique({ where: { id } });
  }

  async findBySellerAndUser(sellerId: string, userId: string): Promise<SellerStaff | null> {
    return this.prisma.sellerStaff.findUnique({
      where: {
        sellerId_userId: { sellerId, userId },
      },
    });
  }

  async findBySellerId(sellerId: string): Promise<SellerStaff[]> {
    return this.prisma.sellerStaff.findMany({
      where: { sellerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: Prisma.SellerStaffCreateInput): Promise<SellerStaff> {
    return this.prisma.sellerStaff.create({ data });
  }

  async updateStatus(id: string, status: SellerStaffStatus): Promise<SellerStaff> {
    return this.prisma.sellerStaff.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.sellerStaff.delete({ where: { id } });
  }
}
