import { Test, TestingModule } from '@nestjs/testing';
import { ProductsSellerService } from './products-seller.service';
import { ProductsRepository } from '../infrastructure/products.repository';
import { ProductVariantsRepository } from '../infrastructure/product-variants.repository';
import { CategoriesRepository } from '../infrastructure/categories.repository';
import { SellersRepository } from '../../sellers/infrastructure/sellers.repository';
import { StoresRepository } from '../../sellers/infrastructure/stores.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SellerStatus, StoreStatus, CategoryStatus, ProductStatus, ProductVisibility } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('ProductsSellerService', () => {
  let service: ProductsSellerService;
  let productsRepo: jest.Mocked<ProductsRepository>;
  let sellersRepo: jest.Mocked<SellersRepository>;
  let storesRepo: jest.Mocked<StoresRepository>;
  let categoriesRepo: jest.Mocked<CategoriesRepository>;
  let variantsRepo: jest.Mocked<ProductVariantsRepository>;

  const mockSeller = {
    id: 'sel_123',
    userId: 'usr_seller_1',
    status: SellerStatus.ACTIVE,
  };

  const mockStore = {
    id: 'str_123',
    sellerId: 'sel_123',
    status: StoreStatus.ACTIVE,
  };

  const mockCategory = {
    id: 'cat_123',
    status: CategoryStatus.ACTIVE,
  };

  const mockProduct = {
    id: 'prd_123',
    storeId: 'str_123',
    categoryId: 'cat_123',
    name: 'Summer Dress',
    slug: 'summer-dress',
    status: ProductStatus.DRAFT,
    visibility: ProductVisibility.PUBLIC,
    basePrice: 500,
    currency: 'EGP',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsSellerService,
        {
          provide: ProductsRepository,
          useValue: {
            findById: jest.fn(),
            findByStoreAndSlug: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            findMany: jest.fn(),
          },
        },
        {
          provide: ProductVariantsRepository,
          useValue: {
            findVariantBySku: jest.fn(),
            createVariant: jest.fn(),
            createOption: jest.fn(),
            createOptionValue: jest.fn(),
            addMedia: jest.fn(),
            deleteMedia: jest.fn(),
          },
        },
        {
          provide: CategoriesRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: SellersRepository,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: StoresRepository,
          useValue: {
            findBySellerId: jest.fn(),
          },
        },
        {
          provide: SecurityAuditService,
          useValue: {
            logEvent: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsSellerService>(ProductsSellerService);
    productsRepo = module.get(ProductsRepository);
    variantsRepo = module.get(ProductVariantsRepository);
    categoriesRepo = module.get(CategoriesRepository);
    sellersRepo = module.get(SellersRepository);
    storesRepo = module.get(StoresRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct', () => {
    it('should create product in DRAFT status', async () => {
      sellersRepo.findByUserId.mockResolvedValue(mockSeller as any);
      storesRepo.findBySellerId.mockResolvedValue(mockStore as any);
      categoriesRepo.findById.mockResolvedValue(mockCategory as any);
      productsRepo.findByStoreAndSlug.mockResolvedValue(null);
      productsRepo.create.mockResolvedValue(mockProduct as any);
      productsRepo.findById.mockResolvedValue(mockProduct as any);

      const result = await service.createProduct('usr_seller_1', {
        categoryId: 'cat_123',
        name: 'Summer Dress',
        basePrice: 500,
      });

      expect(result.status).toBe(ProductStatus.DRAFT);
      expect(productsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Summer Dress',
          status: ProductStatus.DRAFT,
          basePrice: 500,
        }),
      );
    });

    it('should throw ForbiddenException if user is not a seller', async () => {
      sellersRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.createProduct('usr_customer_1', {
          categoryId: 'cat_123',
          name: 'Summer Dress',
          basePrice: 500,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if base price is negative', async () => {
      sellersRepo.findByUserId.mockResolvedValue(mockSeller as any);
      storesRepo.findBySellerId.mockResolvedValue(mockStore as any);
      categoriesRepo.findById.mockResolvedValue(mockCategory as any);

      await expect(
        service.createProduct('usr_seller_1', {
          categoryId: 'cat_123',
          name: 'Summer Dress',
          basePrice: -50,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addVariant', () => {
    it('should throw ConflictException if SKU already exists', async () => {
      sellersRepo.findByUserId.mockResolvedValue(mockSeller as any);
      storesRepo.findBySellerId.mockResolvedValue(mockStore as any);
      productsRepo.findById.mockResolvedValue(mockProduct as any);
      variantsRepo.findVariantBySku.mockResolvedValue({ id: 'v_existing' } as any);

      await expect(
        service.addVariant('usr_seller_1', 'prd_123', {
          sku: 'DRESS-BLK-S',
          optionValueIds: ['opt_val_1'],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
