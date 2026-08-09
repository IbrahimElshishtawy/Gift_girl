import { Store as PrismaStore, StoreStatus } from '@prisma/client';

export class StoreEntity {
  constructor(
    public readonly id: string,
    public readonly sellerId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly logoUrl: string | null,
    public readonly bannerUrl: string | null,
    public readonly status: StoreStatus,
    public readonly contactEmail: string,
    public readonly contactPhone: string,
    public readonly country: string,
    public readonly governorateState: string,
    public readonly city: string,
    public readonly address: string | null,
    public readonly returnPolicy: string | null,
    public readonly shippingPolicy: string | null,
    public readonly rejectionReason: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaStore): StoreEntity {
    return new StoreEntity(
      prisma.id,
      prisma.sellerId,
      prisma.name,
      prisma.slug,
      prisma.description,
      prisma.logoUrl,
      prisma.bannerUrl,
      prisma.status,
      prisma.contactEmail,
      prisma.contactPhone,
      prisma.country,
      prisma.governorateState,
      prisma.city,
      prisma.address,
      prisma.returnPolicy,
      prisma.shippingPolicy,
      prisma.rejectionReason,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
