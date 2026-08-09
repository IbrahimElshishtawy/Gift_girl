import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../infrastructure/products.repository';
import { ProductEntity } from '../domain/product.entity';
import {
  ProductStatus,
  ProductVisibility,
  CategoryStatus,
  SellerStatus,
  StoreStatus,
  Prisma,
} from '@prisma/client';

export interface PublicProductQueryParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  storeId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
}

@Injectable()
export class ProductsPublicService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async listPublicProducts(params: PublicProductQueryParams) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Strict Public Visibility Filter Matrix:
    // Product MUST be PUBLISHED AND PUBLIC AND Store ACTIVE AND Seller ACTIVE AND Category ACTIVE
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      visibility: ProductVisibility.PUBLIC,
      store: {
        status: StoreStatus.ACTIVE,
        seller: {
          status: SellerStatus.ACTIVE,
        },
      },
      category: {
        status: CategoryStatus.ACTIVE,
      },
    };

    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }

    if (params.storeId) {
      where.storeId = params.storeId;
    }

    if (params.brandId) {
      where.brandId = params.brandId;
    }

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.basePrice = {};
      if (params.minPrice !== undefined) {
        where.basePrice.gte = params.minPrice;
      }
      if (params.maxPrice !== undefined) {
        where.basePrice.lte = params.maxPrice;
      }
    }

    if (params.search && params.search.trim() !== '') {
      const term = params.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { shortDescription: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (params.sortBy === 'price_asc') {
      orderBy = { basePrice: 'asc' };
    } else if (params.sortBy === 'price_desc') {
      orderBy = { basePrice: 'desc' };
    }

    const { items, total } = await this.productsRepository.findMany({
      skip,
      take: limit,
      where,
      orderBy,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: items.map(ProductEntity.fromPrisma),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async getPublicProductBySlug(slug: string): Promise<ProductEntity> {
    const product = await this.productsRepository.findPublicBySlug(slug);
    if (!product) {
      throw new NotFoundException(`Product with slug '${slug}' not found.`);
    }

    return ProductEntity.fromPrisma(product);
  }
}
