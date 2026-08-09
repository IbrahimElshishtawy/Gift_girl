import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Product, ProductStatus, ProductVisibility, Prisma } from '@prisma/client';

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    brand: true;
    options: { include: { values: true } };
    variants: { include: { optionValues: { include: { optionValue: true } } } };
    attributes: true;
    media: true;
  };
}>;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        options: {
          orderBy: { position: 'asc' },
          include: {
            values: { orderBy: { position: 'asc' } },
          },
        },
        variants: {
          include: {
            optionValues: {
              include: { optionValue: true },
            },
          },
        },
        attributes: true,
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });
  }

  async findByStoreAndSlug(storeId: string, slug: string): Promise<ProductWithRelations | null> {
    return this.prisma.product.findUnique({
      where: {
        storeId_slug: {
          storeId,
          slug: slug.toLowerCase(),
        },
      },
      include: {
        category: true,
        brand: true,
        options: {
          orderBy: { position: 'asc' },
          include: {
            values: { orderBy: { position: 'asc' } },
          },
        },
        variants: {
          include: {
            optionValues: {
              include: { optionValue: true },
            },
          },
        },
        attributes: true,
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });
  }

  async findPublicBySlug(slug: string): Promise<ProductWithRelations | null> {
    const product = await this.prisma.product.findFirst({
      where: {
        slug: slug.toLowerCase(),
        status: ProductStatus.PUBLISHED,
        visibility: ProductVisibility.PUBLIC,
        store: { status: 'ACTIVE', seller: { status: 'ACTIVE' } },
        category: { status: 'ACTIVE' },
      },
      include: {
        category: true,
        brand: true,
        options: {
          orderBy: { position: 'asc' },
          include: {
            values: { orderBy: { position: 'asc' } },
          },
        },
        variants: {
          where: { status: 'ACTIVE' },
          include: {
            optionValues: {
              include: { optionValue: true },
            },
          },
        },
        attributes: true,
        media: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });

    return product;
  }

  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return this.prisma.product.create({
      data: {
        ...data,
        slug: data.slug.toLowerCase(),
      },
    });
  }

  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: ProductStatus, reason?: string): Promise<Product> {
    const data: Prisma.ProductUpdateInput = { status };
    if (status === ProductStatus.REJECTED) {
      data.rejectionReason = reason || 'Rejected by administrator';
    } else if (status === ProductStatus.PUBLISHED) {
      data.publishedAt = new Date();
    } else if (status === ProductStatus.ARCHIVED) {
      data.archivedAt = new Date();
    }

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Product> {
    return this.prisma.product.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ProductWhereInput;
    orderBy?: Prisma.ProductOrderByWithRelationInput;
  }): Promise<{ items: ProductWithRelations[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        include: {
          category: true,
          brand: true,
          options: {
            orderBy: { position: 'asc' },
            include: {
              values: { orderBy: { position: 'asc' } },
            },
          },
          variants: {
            include: {
              optionValues: {
                include: { optionValue: true },
              },
            },
          },
          attributes: true,
          media: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
        },
        orderBy: params.orderBy || { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: params.where }),
    ]);

    return { items, total };
  }
}
