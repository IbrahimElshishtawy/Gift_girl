import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ProductVariant,
  ProductOption,
  ProductOptionValue,
  ProductAttribute,
  ProductMedia,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ProductVariantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVariantById(id: string): Promise<ProductVariant | null> {
    return this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        optionValues: {
          include: { optionValue: true },
        },
      },
    });
  }

  async findVariantBySku(sku: string): Promise<ProductVariant | null> {
    return this.prisma.productVariant.findUnique({
      where: { sku: sku.trim().toUpperCase() },
    });
  }

  async createOption(productId: string, name: string, position = 0): Promise<ProductOption> {
    return this.prisma.productOption.create({
      data: {
        productId,
        name: name.trim(),
        position,
      },
    });
  }

  async createOptionValue(
    optionId: string,
    value: string,
    position = 0,
  ): Promise<ProductOptionValue> {
    return this.prisma.productOptionValue.create({
      data: {
        optionId,
        value: value.trim(),
        position,
      },
    });
  }

  async createVariant(
    productId: string,
    sku: string,
    price: number | null,
    compareAtPrice: number | null,
    optionValueIds: string[],
    isDefault = false,
  ): Promise<ProductVariant> {
    const normalizedSku = sku.trim().toUpperCase();
    const sortedOptionValueIds = [...optionValueIds].sort();
    const optionCombinationHash = sortedOptionValueIds.join(':');

    return this.prisma.productVariant.create({
      data: {
        productId,
        sku: normalizedSku,
        price,
        compareAtPrice,
        optionCombinationHash: optionCombinationHash || null,
        isDefault,
        optionValues: {
          create: sortedOptionValueIds.map((id) => ({
            optionValue: { connect: { id } },
          })),
        },
        inventory: {
          create: {
            onHandQuantity: 0,
            reservedQuantity: 0,
            lowStockThreshold: 10,
            status: 'OUT_OF_STOCK',
          },
        },
      },
      include: {
        optionValues: {
          include: { optionValue: true },
        },
      },
    });
  }

  async updateVariant(id: string, data: Prisma.ProductVariantUpdateInput): Promise<ProductVariant> {
    return this.prisma.productVariant.update({
      where: { id },
      data,
      include: {
        optionValues: {
          include: { optionValue: true },
        },
      },
    });
  }

  async deleteVariant(id: string): Promise<ProductVariant> {
    return this.prisma.productVariant.delete({ where: { id } });
  }

  async addAttribute(productId: string, key: string, value: string): Promise<ProductAttribute> {
    return this.prisma.productAttribute.upsert({
      where: {
        productId_key: {
          productId,
          key: key.trim(),
        },
      },
      create: {
        productId,
        key: key.trim(),
        value: value.trim(),
      },
      update: {
        value: value.trim(),
      },
    });
  }

  async deleteAttribute(productId: string, key: string): Promise<ProductAttribute> {
    return this.prisma.productAttribute.delete({
      where: {
        productId_key: {
          productId,
          key: key.trim(),
        },
      },
    });
  }

  async addMedia(data: Prisma.ProductMediaCreateInput): Promise<ProductMedia> {
    return this.prisma.productMedia.create({ data });
  }

  async deleteMedia(id: string): Promise<ProductMedia> {
    return this.prisma.productMedia.delete({ where: { id } });
  }
}
