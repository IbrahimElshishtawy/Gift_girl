import {
  SellerApplication as PrismaSellerApplication,
  SellerApplicationStatus,
} from '@prisma/client';

export class SellerApplicationEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly sellerId: string | null,
    public readonly businessName: string,
    public readonly businessType: string | null,
    public readonly taxNumber: string | null,
    public readonly commercialRegister: string | null,
    public readonly contactPhone: string,
    public readonly contactEmail: string,
    public readonly notes: string | null,
    public readonly status: SellerApplicationStatus,
    public readonly rejectionReason: string | null,
    public readonly reviewedByUserId: string | null,
    public readonly reviewedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaSellerApplication): SellerApplicationEntity {
    return new SellerApplicationEntity(
      prisma.id,
      prisma.userId,
      prisma.sellerId,
      prisma.businessName,
      prisma.businessType,
      prisma.taxNumber,
      prisma.commercialRegister,
      prisma.contactPhone,
      prisma.contactEmail,
      prisma.notes,
      prisma.status,
      prisma.rejectionReason,
      prisma.reviewedByUserId,
      prisma.reviewedAt,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
