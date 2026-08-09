import { Brand as PrismaBrand, BrandStatus } from '@prisma/client';

export class BrandEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly logoUrl: string | null,
    public readonly description: string | null,
    public readonly status: BrandStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaBrand): BrandEntity {
    return new BrandEntity(
      prisma.id,
      prisma.name,
      prisma.slug,
      prisma.logoUrl,
      prisma.description,
      prisma.status,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
