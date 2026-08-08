import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';

describe('UserProfileService', () => {
  let service: UserProfileService;

  const mockProfile = {
    id: 'p_1',
    userId: 'usr_1',
    firstName: 'Sarah',
    lastName: 'Elshishtawy',
    displayName: 'Sarah E.',
    avatarUrl: null,
    dateOfBirth: null,
    gender: 'Female',
    locale: 'en',
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPreference = {
    id: 'pref_1',
    userId: 'usr_1',
    language: 'ar',
    currency: 'EGP',
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: true,
    marketingConsent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'usr_1' }),
    },
    userProfile: {
      findUnique: jest.fn().mockResolvedValue(mockProfile),
      create: jest.fn().mockResolvedValue(mockProfile),
      upsert: jest.fn().mockResolvedValue(mockProfile),
    },
    userPreference: {
      findUnique: jest.fn().mockResolvedValue(mockPreference),
      create: jest.fn().mockResolvedValue(mockPreference),
      upsert: jest.fn().mockResolvedValue(mockPreference),
    },
  };

  const mockSecurityAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'sa_1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve user profile', async () => {
    const profile = await service.getProfile('usr_1');
    expect(profile.firstName).toBe('Sarah');
  });

  it('should update profile and log audit event', async () => {
    const updated = await service.updateProfile('usr_1', { firstName: 'Sarah' });
    expect(updated.firstName).toBe('Sarah');
    expect(mockSecurityAuditService.logEvent).toHaveBeenCalled();
  });

  it('should retrieve and update preferences', async () => {
    const pref = await service.getPreferences('usr_1');
    expect(pref.language).toBe('ar');

    const updatedPref = await service.updatePreferences('usr_1', { language: 'en' });
    expect(updatedPref.language).toBe('ar');
  });
});
