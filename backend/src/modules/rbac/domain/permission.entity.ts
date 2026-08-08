import { Permission as PrismaPermission } from '@prisma/client';

export class PermissionEntity {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly resource: string,
    public readonly action: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaPermission): PermissionEntity {
    return new PermissionEntity(
      prisma.id,
      prisma.code,
      prisma.name,
      prisma.description,
      prisma.resource,
      prisma.action,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
