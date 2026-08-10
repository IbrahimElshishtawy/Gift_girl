import { Test, TestingModule } from '@nestjs/testing';
import { WishlistService } from './wishlist.service';
import { WishlistsRepository } from '../infrastructure/wishlists.repository';
import { CartService } from './cart.service';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { NotFoundException } from '@nestjs/common';

describe('WishlistService', () => {
  let service: WishlistService;
  let mockWishlistsRepository: any;
  let mockCartService: any;
  let mockPrismaService: any;
  let mockSecurityAuditService: any;

  const mockWishlist = {
    id: 'wishlist_1',
    userId: 'user_1',
    name: 'My Wishlist',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'w_item_1',
        wishlistId: 'wishlist_1',
        variantId: 'var_1',
        createdAt: new Date(),
        variant: {
          id: 'var_1',
          sku: 'DRESS-BLK-M',
          price: 499.99,
          product: {
            id: 'prod_1',
            name: 'Silk Dress',
            slug: 'silk-dress',
            basePrice: 499.99,
          },
        },
      },
    ],
  };

  beforeEach(async () => {
    mockWishlistsRepository = {
      findOrCreateByUserId: jest.fn().mockResolvedValue(mockWishlist),
      addItem: jest.fn().mockResolvedValue({ id: 'w_item_1' }),
      removeItem: jest.fn().mockResolvedValue({ id: 'w_item_1' }),
    };

    mockCartService = {
      addItemToCart: jest.fn().mockResolvedValue({ id: 'cart_1' }),
    };

    mockPrismaService = {
      productVariant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'var_1' }),
      },
    };

    mockSecurityAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: WishlistsRepository, useValue: mockWishlistsRepository },
        { provide: CartService, useValue: mockCartService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
  });

  it('should get user wishlist', async () => {
    const result = await service.getUserWishlist('user_1');
    expect(result.id).toBe('wishlist_1');
    expect(result.items).toHaveLength(1);
  });

  it('should add item to wishlist idempotently', async () => {
    const result = await service.addItemToWishlist('user_1', { variantId: 'var_1' });
    expect(mockWishlistsRepository.addItem).toHaveBeenCalledWith('wishlist_1', 'var_1');
    expect(result.id).toBe('wishlist_1');
  });

  it('should remove item from wishlist', async () => {
    const result = await service.removeItemFromWishlist('user_1', 'var_1');
    expect(mockWishlistsRepository.removeItem).toHaveBeenCalledWith('wishlist_1', 'var_1');
    expect(result.id).toBe('wishlist_1');
  });

  it('should move item from wishlist to cart', async () => {
    await service.moveWishlistItemToCart('user_1', 'var_1');

    expect(mockCartService.addItemToCart).toHaveBeenCalledWith(
      'user_1',
      { variantId: 'var_1', quantity: 1 },
      undefined,
      undefined,
    );
    expect(mockWishlistsRepository.removeItem).toHaveBeenCalledWith('wishlist_1', 'var_1');
  });
});
