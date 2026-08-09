import { Category as PrismaCategory, CategoryStatus } from '@prisma/client';

export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly imageUrl: string | null,
    public readonly parentId: string | null,
    public readonly status: CategoryStatus,
    public readonly sortOrder: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly children?: CategoryEntity[],
  ) {}

  static fromPrisma(
    prisma: PrismaCategory & { children?: PrismaCategory[] },
  ): CategoryEntity {
    return new CategoryEntity(
      prisma.id,
      prisma.name,
      prisma.slug,
      prisma.description,
      prisma.imageUrl,
      prisma.parentId,
      prisma.status,
      prisma.sortOrder,
      prisma.createdAt,
      prisma.updatedAt,
      prisma.children ? prisma.children.map((c) => CategoryEntity.fromPrisma(c)) : undefined,
    );
  }
}
