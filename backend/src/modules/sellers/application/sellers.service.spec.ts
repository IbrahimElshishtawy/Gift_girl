import { Test, TestingModule } from '@nestjs/testing';
import { SellersService } from './sellers.service';
import { SellersRepository } from '../infrastructure/sellers.repository';
import { SellerStaffRepository } from '../infrastructure/seller-staff.repository';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SellerStatus, SellerStaffStatus } from '@prisma/client';

describe('SellersService', () => {
  let service: SellersService;

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
    address: 'Abbas El Akkad St',
    status: SellerStatus.ACTIVE,
    verificationStatus: 'VERIFIED',
    rejectionReason: null,
    approvedAt: new Date(),
    suspendedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStaff = {
    id: 'stf_1',
    sellerId: 'sel_1',
    userId: 'usr_staff_1',
    role: 'STAFF',
    status: SellerStaffStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSellersRepo = {
    findByUserId: jest.fn().mockResolvedValue(mockSeller),
    findById: jest.fn().mockResolvedValue(mockSeller),
    update: jest.fn().mockResolvedValue(mockSeller),
    updateStatus: jest.fn().mockResolvedValue({ ...mockSeller, status: SellerStatus.SUSPENDED }),
    findMany: jest.fn().mockResolvedValue({ items: [mockSeller], total: 1 }),
  };

  const mockStaffRepo = {
    findById: jest.fn().mockResolvedValue(mockStaff),
    findBySellerId: jest.fn().mockResolvedValue([mockStaff]),
    findBySellerAndUser: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockStaff),
    updateStatus: jest.fn().mockResolvedValue({ ...mockStaff, status: SellerStaffStatus.SUSPENDED }),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'usr_staff_1' }),
    },
  };

  const mockAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'sa_1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellersService,
        { provide: SellersRepository, useValue: mockSellersRepo },
        { provide: SellerStaffRepository, useValue: mockStaffRepo },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SecurityAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<SellersService>(SellersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve seller profile by user ID', async () => {
    const seller = await service.getSellerByUserId('usr_1');
    expect(seller.businessName).toBe('Lotus Fashion');
  });

  it('should suspend seller profile by admin', async () => {
    const suspended = await service.updateSellerStatus('admin_1', 'sel_1', SellerStatus.SUSPENDED, 'Policy violation');
    expect(suspended.status).toBe(SellerStatus.SUSPENDED);
    expect(mockAuditService.logEvent).toHaveBeenCalled();
  });

  it('should add staff member to seller team', async () => {
    const staff = await service.addStaffMember('usr_1', 'usr_staff_1');
    expect(staff.id).toBe('stf_1');
  });
});
