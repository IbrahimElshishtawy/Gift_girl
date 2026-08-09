import { SellerStaff as PrismaSellerStaff, SellerStaffStatus } from '@prisma/client';

export class SellerStaffEntity {
  constructor(
    public readonly id: string,
    public readonly sellerId: string,
    public readonly userId: string,
    public readonly role: string,
    public readonly status: SellerStaffStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaSellerStaff): SellerStaffEntity {
    return new SellerStaffEntity(
      prisma.id,
      prisma.sellerId,
      prisma.userId,
      prisma.role,
      prisma.status,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
