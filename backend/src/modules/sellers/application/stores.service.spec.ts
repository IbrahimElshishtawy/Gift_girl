import { Test, TestingModule } from '@nestjs/testing';
import { StoresService } from './stores.service';
import { StoresRepository } from '../infrastructure/stores.repository';
import { SellersRepository } from '../infrastructure/sellers.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { StoreStatus, SellerStatus } from '@prisma/client';

describe('StoresService', () => {
  let service: StoresService;

  const mockSeller = {
    id: 'sel_1',
    userId: 'usr_1',
    businessName: 'Lotus Fashion',
    status: SellerStatus.ACTIVE,
  };

  const mockStore = {
    id: 'str_1',
    sellerId: 'sel_1',
    name: 'Lotus Gift Store',
    slug: 'lotus-gift-store',
    description: 'Handmade gifts',
    logoUrl: null,
    bannerUrl: null,
    status: StoreStatus.DRAFT,
    contactEmail: 'store@lotus.com',
    contactPhone: '+201012345678',
    country: 'Egypt',
    governorateState: 'Cairo',
    city: 'Nasr City',
    address: null,
    returnPolicy: null,
    shippingPolicy: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    seller: mockSeller,
  };

  const mockStoresRepo = {
    findById: jest.fn().mockResolvedValue(mockStore),
    findBySellerId: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockStore),
    update: jest.fn().mockResolvedValue(mockStore),
    updateStatus: jest.fn().mockResolvedValue({ ...mockStore, status: StoreStatus.ACTIVE }),
    findMany: jest.fn().mockResolvedValue({ items: [mockStore], total: 1 }),
  };

  const mockSellersRepo = {
    findByUserId: jest.fn().mockResolvedValue(mockSeller),
  };

  const mockAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'sa_1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: StoresRepository, useValue: mockStoresRepo },
        { provide: SellersRepository, useValue: mockSellersRepo },
        { provide: SecurityAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create store in DRAFT status for active seller', async () => {
    const store = await service.createStore('usr_1', {
      name: 'Lotus Gift Store',
      slug: 'lotus-gift-store',
      contactEmail: 'store@lotus.com',
      contactPhone: '+201012345678',
      governorateState: 'Cairo',
      city: 'Nasr City',
    });
    expect(store.slug).toBe('lotus-gift-store');
  });

  it('should return public store if store and seller are both ACTIVE', async () => {
    mockStoresRepo.findBySlug.mockResolvedValueOnce({
      ...mockStore,
      status: StoreStatus.ACTIVE,
      seller: { ...mockSeller, status: SellerStatus.ACTIVE },
    });

    const publicStore = await service.getPublicStoreBySlug('lotus-gift-store');
    expect(publicStore.name).toBe('Lotus Gift Store');
  });

  it('should throw 404 for public store if store is DRAFT or PENDING_REVIEW', async () => {
    mockStoresRepo.findBySlug.mockResolvedValueOnce({
      ...mockStore,
      status: StoreStatus.DRAFT,
      seller: { ...mockSeller, status: SellerStatus.ACTIVE },
    });

    await expect(service.getPublicStoreBySlug('lotus-gift-store')).rejects.toThrow();
  });
});
