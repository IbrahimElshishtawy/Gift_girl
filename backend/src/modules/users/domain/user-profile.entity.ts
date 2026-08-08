import { UserProfile as PrismaUserProfile } from '@prisma/client';

export class UserProfileEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly firstName: string | null,
    public readonly lastName: string | null,
    public readonly displayName: string | null,
    public readonly avatarUrl: string | null,
    public readonly dateOfBirth: Date | null,
    public readonly gender: string | null,
    public readonly locale: string,
    public readonly timezone: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaUserProfile): UserProfileEntity {
    return new UserProfileEntity(
      prisma.id,
      prisma.userId,
      prisma.firstName,
      prisma.lastName,
      prisma.displayName,
      prisma.avatarUrl,
      prisma.dateOfBirth,
      prisma.gender,
      prisma.locale,
      prisma.timezone,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
