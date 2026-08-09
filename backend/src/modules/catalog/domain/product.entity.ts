import {
  Product as PrismaProduct,
  ProductStatus,
  ProductVisibility,
  Category as PrismaCategory,
  Brand as PrismaBrand,
  ProductOption as PrismaProductOption,
  ProductOptionValue as PrismaProductOptionValue,
  ProductVariant as PrismaProductVariant,
  ProductVariantOptionValue as PrismaProductVariantOptionValue,
  ProductAttribute as PrismaProductAttribute,
  ProductMedia as PrismaProductMedia,
} from '@prisma/client';
import { CategoryEntity } from './category.entity';
import { BrandEntity } from './brand.entity';
import { ProductOptionEntity } from './product-option.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductAttributeEntity } from './product-attribute.entity';
import { ProductMediaEntity } from './product-media.entity';

export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly storeId: string,
    public readonly categoryId: string,
    public readonly brandId: string | null,
    public readonly name: string,
    public readonly slug: string,
    public readonly shortDescription: string | null,
    public readonly description: string | null,
    public readonly status: ProductStatus,
    public readonly visibility: ProductVisibility,
    public readonly basePrice: number,
    public readonly compareAtPrice: number | null,
    public readonly currency: string,
    public readonly rejectionReason: string | null,
    public readonly publishedAt: Date | null,
    public readonly archivedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly category?: CategoryEntity,
    public readonly brand?: BrandEntity,
    public readonly options?: ProductOptionEntity[],
    public readonly variants?: ProductVariantEntity[],
    public readonly attributes?: ProductAttributeEntity[],
    public readonly media?: ProductMediaEntity[],
  ) {}

  static fromPrisma(
    prisma: PrismaProduct & {
      category?: PrismaCategory;
      brand?: PrismaBrand | null;
      options?: (PrismaProductOption & { values?: PrismaProductOptionValue[] })[];
      variants?: (PrismaProductVariant & {
        optionValues?: (PrismaProductVariantOptionValue & {
          optionValue: PrismaProductOptionValue;
        })[];
      })[];
      attributes?: PrismaProductAttribute[];
      media?: PrismaProductMedia[];
    },
  ): ProductEntity {
    return new ProductEntity(
      prisma.id,
      prisma.storeId,
      prisma.categoryId,
      prisma.brandId,
      prisma.name,
      prisma.slug,
      prisma.shortDescription,
      prisma.description,
      prisma.status,
      prisma.visibility,
      Number(prisma.basePrice),
      prisma.compareAtPrice ? Number(prisma.compareAtPrice) : null,
      prisma.currency,
      prisma.rejectionReason,
      prisma.publishedAt,
      prisma.archivedAt,
      prisma.createdAt,
      prisma.updatedAt,
      prisma.category ? CategoryEntity.fromPrisma(prisma.category) : undefined,
      prisma.brand ? BrandEntity.fromPrisma(prisma.brand) : undefined,
      prisma.options ? prisma.options.map(ProductOptionEntity.fromPrisma) : undefined,
      prisma.variants ? prisma.variants.map(ProductVariantEntity.fromPrisma) : undefined,
      prisma.attributes ? prisma.attributes.map(ProductAttributeEntity.fromPrisma) : undefined,
      prisma.media ? prisma.media.map(ProductMediaEntity.fromPrisma) : undefined,
    );
  }
}
