import {
  Seller as PrismaSeller,
  SellerStatus,
  SellerVerificationStatus,
} from '@prisma/client';

export class SellerEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly businessName: string,
    public readonly legalName: string | null,
    public readonly description: string | null,
    public readonly phone: string,
    public readonly email: string,
    public readonly country: string,
    public readonly governorateState: string,
    public readonly city: string,
    public readonly address: string,
    public readonly status: SellerStatus,
    public readonly verificationStatus: SellerVerificationStatus,
    public readonly rejectionReason: string | null,
    public readonly approvedAt: Date | null,
    public readonly suspendedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaSeller): SellerEntity {
    return new SellerEntity(
      prisma.id,
      prisma.userId,
      prisma.businessName,
      prisma.legalName,
      prisma.description,
      prisma.phone,
      prisma.email,
      prisma.country,
      prisma.governorateState,
      prisma.city,
      prisma.address,
      prisma.status,
      prisma.verificationStatus,
      prisma.rejectionReason,
      prisma.approvedAt,
      prisma.suspendedAt,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
