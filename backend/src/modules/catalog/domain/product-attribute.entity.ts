import { ProductAttribute as PrismaProductAttribute } from '@prisma/client';

export class ProductAttributeEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly key: string,
    public readonly value: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaProductAttribute): ProductAttributeEntity {
    return new ProductAttributeEntity(
      prisma.id,
      prisma.productId,
      prisma.key,
      prisma.value,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
