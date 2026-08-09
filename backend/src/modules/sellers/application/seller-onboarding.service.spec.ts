import { Test, TestingModule } from '@nestjs/testing';
import { SellerOnboardingService } from './seller-onboarding.service';
import { PrismaService } from '../../../database/prisma.service';
import { SellerApplicationsRepository } from '../infrastructure/seller-applications.repository';
import { SellerDocumentsRepository } from '../infrastructure/seller-documents.repository';
import { SellersRepository } from '../infrastructure/sellers.repository';
import { RbacService } from '../../rbac/application/rbac.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import {
  SellerApplicationStatus,
  SellerStatus,
  SellerVerificationStatus,
  SellerDocumentStatus,
} from '@prisma/client';

describe('SellerOnboardingService', () => {
  let service: SellerOnboardingService;

  const mockApp = {
    id: 'app_1',
    userId: 'usr_1',
    sellerId: null,
    businessName: 'Lotus Fashion',
    businessType: 'LLC',
    taxNumber: '123456',
    commercialRegister: 'CR99',
    contactPhone: '+201012345678',
    contactEmail: 'contact@lotus.com',
    notes: 'Handmade gifts',
    status: SellerApplicationStatus.SUBMITTED,
    rejectionReason: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSeller = {
    id: 'sel_1',
    userId: 'usr_1',
    businessName: 'Lotus Fashion',
    legalName: null,
    description: null,
    phone: '+201012345678',
    email: 'contact@lotus.com',
    country: 'Egypt',
    governorateState: 'Cairo',
    city: 'Nasr City',
    address: 'Abbas El Akkad',
    status: SellerStatus.ACTIVE,
    verificationStatus: SellerVerificationStatus.VERIFIED,
    rejectionReason: null,
    approvedAt: new Date(),
    suspendedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation(async (cb) =>
      cb({
        seller: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockSeller),
          update: jest.fn().mockResolvedValue(mockSeller),
        },
        sellerApplication: {
          update: jest.fn().mockResolvedValue({
            ...mockApp,
            status: SellerApplicationStatus.APPROVED,
            sellerId: 'sel_1',
          }),
        },
      }),
    ),
  };

  const mockAppsRepo = {
    findById: jest.fn().mockResolvedValue(mockApp),
    findLatestByUserId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockApp),
    updateStatus: jest
      .fn()
      .mockResolvedValue({ ...mockApp, status: SellerApplicationStatus.REJECTED }),
  };

  const mockDocsRepo = {
    findById: jest.fn().mockResolvedValue({
      id: 'doc_1',
      sellerId: 'sel_1',
      type: 'BUSINESS_LICENSE',
      status: 'PENDING',
    }),
    findBySellerId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({
      id: 'doc_1',
      sellerId: 'sel_1',
      type: 'BUSINESS_LICENSE',
      status: 'PENDING',
      fileReference: 'ref_1',
      fileName: null,
      rejectionReason: null,
      uploadedAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
    }),
    updateStatus: jest.fn().mockResolvedValue({
      id: 'doc_1',
      sellerId: 'sel_1',
      type: 'BUSINESS_LICENSE',
      status: SellerDocumentStatus.VERIFIED,
      fileReference: 'ref_1',
      fileName: null,
      rejectionReason: null,
      uploadedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: 'admin_1',
    }),
  };

  const mockSellersRepo = {
    findByUserId: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(mockSeller),
  };

  const mockRbacService = {
    assignRolesToUser: jest.fn().mockResolvedValue(undefined),
  };

  const mockAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'sa_1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellerOnboardingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SellerApplicationsRepository, useValue: mockAppsRepo },
        { provide: SellerDocumentsRepository, useValue: mockDocsRepo },
        { provide: SellersRepository, useValue: mockSellersRepo },
        { provide: RbacService, useValue: mockRbacService },
        { provide: SecurityAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<SellerOnboardingService>(SellerOnboardingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should submit seller application', async () => {
    const app = await service.applyForSeller('usr_1', {
      businessName: 'Lotus Fashion',
      contactPhone: '+201012345678',
      contactEmail: 'contact@lotus.com',
    });
    expect(app.businessName).toBe('Lotus Fashion');
  });

  it('should approve seller application atomically', async () => {
    mockAppsRepo.findById.mockResolvedValueOnce(mockApp);
    const approved = await service.approveApplication('admin_1', 'app_1');
    expect(approved.status).toBe(SellerApplicationStatus.APPROVED);
    expect(mockRbacService.assignRolesToUser).toHaveBeenCalled();
  });

  it('should reject seller application', async () => {
    mockAppsRepo.findById.mockResolvedValueOnce(mockApp);
    const rejected = await service.rejectApplication('admin_1', 'app_1', 'Invalid documents');
    expect(rejected.status).toBe(SellerApplicationStatus.REJECTED);
  });
});
