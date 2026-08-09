import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Category, CategoryStatus, Prisma } from '@prisma/client';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<(Category & { children?: Category[] }) | null> {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { slug: slug.toLowerCase() },
    });
  }

  async findRootCategories(activeOnly = false): Promise<(Category & { children?: Category[] })[]> {
    const where: Prisma.CategoryWhereInput = { parentId: null };
    if (activeOnly) {
      where.status = CategoryStatus.ACTIVE;
    }

    return this.prisma.category.findMany({
      where,
      include: {
        children: {
          where: activeOnly ? { status: CategoryStatus.ACTIVE } : undefined,
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              where: activeOnly ? { status: CategoryStatus.ACTIVE } : undefined,
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return this.prisma.category.create({
      data: {
        ...data,
        slug: data.slug.toLowerCase(),
      },
    });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: CategoryStatus): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data: { status },
    });
  }

  async countProductsInCategory(id: string): Promise<number> {
    return this.prisma.product.count({
      where: { categoryId: id },
    });
  }

  async delete(id: string): Promise<Category> {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.CategoryWhereInput;
    orderBy?: Prisma.CategoryOrderByWithRelationInput;
  }): Promise<{ items: Category[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy || { sortOrder: 'asc' },
      }),
      this.prisma.category.count({ where: params.where }),
    ]);

    return { items, total };
  }
}
