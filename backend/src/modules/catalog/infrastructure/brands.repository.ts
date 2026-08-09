import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Brand, Prisma } from '@prisma/client';

@Injectable()
export class BrandsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Brand | null> {
    return this.prisma.brand.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Brand | null> {
    return this.prisma.brand.findUnique({ where: { slug: slug.toLowerCase() } });
  }

  async create(data: Prisma.BrandCreateInput): Promise<Brand> {
    return this.prisma.brand.create({
      data: {
        ...data,
        slug: data.slug.toLowerCase(),
      },
    });
  }

  async update(id: string, data: Prisma.BrandUpdateInput): Promise<Brand> {
    return this.prisma.brand.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Brand> {
    return this.prisma.brand.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.BrandWhereInput;
    orderBy?: Prisma.BrandOrderByWithRelationInput;
  }): Promise<{ items: Brand[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy || { name: 'asc' },
      }),
      this.prisma.brand.count({ where: params.where }),
    ]);

    return { items, total };
  }
}
