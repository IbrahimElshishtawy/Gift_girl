import {
  ProductOption as PrismaProductOption,
  ProductOptionValue as PrismaProductOptionValue,
} from '@prisma/client';

export class ProductOptionValueEntity {
  constructor(
    public readonly id: string,
    public readonly optionId: string,
    public readonly value: string,
    public readonly position: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaProductOptionValue): ProductOptionValueEntity {
    return new ProductOptionValueEntity(
      prisma.id,
      prisma.optionId,
      prisma.value,
      prisma.position,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}

export class ProductOptionEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly name: string,
    public readonly position: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly values: ProductOptionValueEntity[],
  ) {}

  static fromPrisma(
    prisma: PrismaProductOption & { values?: PrismaProductOptionValue[] },
  ): ProductOptionEntity {
    return new ProductOptionEntity(
      prisma.id,
      prisma.productId,
      prisma.name,
      prisma.position,
      prisma.createdAt,
      prisma.updatedAt,
      prisma.values ? prisma.values.map(ProductOptionValueEntity.fromPrisma) : [],
    );
  }
}
