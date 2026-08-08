import { Role as PrismaRole } from '@prisma/client';

export class RoleEntity {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly isSystem: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaRole): RoleEntity {
    return new RoleEntity(
      prisma.id,
      prisma.code,
      prisma.name,
      prisma.description,
      prisma.isSystem,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
