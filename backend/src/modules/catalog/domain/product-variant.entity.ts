import {
  ProductVariant as PrismaProductVariant,
  ProductVariantOptionValue as PrismaProductVariantOptionValue,
  ProductOptionValue as PrismaProductOptionValue,
} from '@prisma/client';
import { ProductOptionValueEntity } from './product-option.entity';

export class ProductVariantEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly sku: string,
    public readonly price: number | null,
    public readonly compareAtPrice: number | null,
    public readonly optionCombinationHash: string | null,
    public readonly isDefault: boolean,
    public readonly status: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly optionValues?: ProductOptionValueEntity[],
  ) {}

  static fromPrisma(
    prisma: PrismaProductVariant & {
      optionValues?: (PrismaProductVariantOptionValue & {
        optionValue: PrismaProductOptionValue;
      })[];
    },
  ): ProductVariantEntity {
    return new ProductVariantEntity(
      prisma.id,
      prisma.productId,
      prisma.sku,
      prisma.price ? Number(prisma.price) : null,
      prisma.compareAtPrice ? Number(prisma.compareAtPrice) : null,
      prisma.optionCombinationHash,
      prisma.isDefault,
      prisma.status,
      prisma.createdAt,
      prisma.updatedAt,
      prisma.optionValues
        ? prisma.optionValues.map((ov) =>
            ProductOptionValueEntity.fromPrisma(ov.optionValue),
          )
        : undefined,
    );
  }
}
