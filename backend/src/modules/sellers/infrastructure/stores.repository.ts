import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Store, Seller, Prisma, StoreStatus } from '@prisma/client';

@Injectable()
export class StoresRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Store | null> {
    return this.prisma.store.findUnique({ where: { id } });
  }

  async findBySellerId(sellerId: string): Promise<Store | null> {
    return this.prisma.store.findFirst({ where: { sellerId } });
  }

  async findBySlug(slug: string): Promise<(Store & { seller: Seller }) | null> {
    return this.prisma.store.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        seller: true,
      },
    });
  }

  async create(data: Prisma.StoreCreateInput): Promise<Store> {
    return this.prisma.store.create({
      data: {
        ...data,
        slug: data.slug.toLowerCase(),
      },
    });
  }

  async update(id: string, data: Prisma.StoreUpdateInput): Promise<Store> {
    return this.prisma.store.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: StoreStatus, rejectionReason?: string): Promise<Store> {
    return this.prisma.store.update({
      where: { id },
      data: {
        status,
        rejectionReason: rejectionReason || null,
      },
    });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.StoreWhereInput;
    orderBy?: Prisma.StoreOrderByWithRelationInput;
  }): Promise<{ items: Store[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy || { createdAt: 'desc' },
        include: {
          seller: {
            select: {
              id: true,
              businessName: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.store.count({ where: params.where }),
    ]);

    return { items, total };
  }
}
