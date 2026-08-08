import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UserProfileEntity } from '../domain/user-profile.entity';
import { UserPreferenceEntity } from '../domain/user-preference.entity';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SecurityEventType } from '@prisma/client';

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: Date;
  gender?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdatePreferenceData {
  language?: string;
  currency?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
  marketingConsent?: boolean;
}

@Injectable()
export class UserProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileEntity> {
    let profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await this.prisma.userProfile.create({
        data: { userId },
      });
    }

    return UserProfileEntity.fromPrisma(profile);
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileData,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserProfileEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const updatedProfile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: {
        ...data,
      },
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.PROFILE_UPDATE,
      userId,
      ipAddress,
      userAgent,
      { updatedFields: Object.keys(data) },
    );

    return UserProfileEntity.fromPrisma(updatedProfile);
  }

  async getPreferences(userId: string): Promise<UserPreferenceEntity> {
    let preference = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      preference = await this.prisma.userPreference.create({
        data: { userId },
      });
    }

    return UserPreferenceEntity.fromPrisma(preference);
  }

  async updatePreferences(
    userId: string,
    data: UpdatePreferenceData,
  ): Promise<UserPreferenceEntity> {
    const updated = await this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: {
        ...data,
      },
    });

    return UserPreferenceEntity.fromPrisma(updated);
  }
}
