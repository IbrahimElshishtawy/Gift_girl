import { ProductMedia as PrismaProductMedia, ProductMediaType } from '@prisma/client';

export class ProductMediaEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly type: ProductMediaType,
    public readonly url: string,
    public readonly altText: string | null,
    public readonly sortOrder: number,
    public readonly isPrimary: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaProductMedia): ProductMediaEntity {
    return new ProductMediaEntity(
      prisma.id,
      prisma.productId,
      prisma.type,
      prisma.url,
      prisma.altText,
      prisma.sortOrder,
      prisma.isPrimary,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
