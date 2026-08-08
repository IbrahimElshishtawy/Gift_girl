import { UserPreference as PrismaUserPreference } from '@prisma/client';

export class UserPreferenceEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly language: string,
    public readonly currency: string,
    public readonly emailNotifications: boolean,
    public readonly pushNotifications: boolean,
    public readonly smsNotifications: boolean,
    public readonly marketingConsent: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(prisma: PrismaUserPreference): UserPreferenceEntity {
    return new UserPreferenceEntity(
      prisma.id,
      prisma.userId,
      prisma.language,
      prisma.currency,
      prisma.emailNotifications,
      prisma.pushNotifications,
      prisma.smsNotifications,
      prisma.marketingConsent,
      prisma.createdAt,
      prisma.updatedAt,
    );
  }
}
