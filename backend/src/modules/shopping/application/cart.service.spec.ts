import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { CartsRepository } from '../infrastructure/carts.repository';
import { CartValidationService } from './cart-validation.service';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartStatus } from '@prisma/client';

describe('CartService', () => {
  let service: CartService;
  let mockCartsRepository: any;
  let mockPrismaService: any;
  let mockSecurityAuditService: any;

  const mockVariant = {
    id: 'var_1',
    sku: 'DRESS-BLK-M',
    status: 'ACTIVE',
    price: 499.99,
    product: {
      id: 'prod_1',
      name: 'Silk Dress',
      status: 'PUBLISHED',
      basePrice: 499.99,
      store: {
        id: 'store_1',
        name: 'Lotus Store',
        status: 'ACTIVE',
        seller: {
          id: 'seller_1',
          status: 'ACTIVE',
        },
      },
    },
    inventory: {
      onHandQuantity: 20,
      reservedQuantity: 0,
      status: 'IN_STOCK',
    },
  };

  const mockCartItem = {
    id: 'item_1',
    cartId: 'cart_1',
    variantId: 'var_1',
    quantity: 2,
    unitPriceSnapshot: 499.99,
    currency: 'EGP',
    createdAt: new Date(),
    updatedAt: new Date(),
    variant: mockVariant,
  };

  const mockCart = {
    id: 'cart_1',
    userId: 'user_1',
    status: CartStatus.ACTIVE,
    currency: 'EGP',
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [mockCartItem],
  };

  beforeEach(async () => {
    mockCartsRepository = {
      findActiveByUserId: jest.fn().mockResolvedValue(mockCart),
      findActiveByGuestTokenHash: jest.fn().mockResolvedValue(null),
      createCart: jest.fn().mockResolvedValue(mockCart),
      upsertItem: jest.fn().mockResolvedValue(mockCartItem),
      updateItemQuantity: jest.fn().mockResolvedValue(mockCartItem),
      removeItem: jest.fn().mockResolvedValue(mockCartItem),
      clearCart: jest.fn().mockResolvedValue(1),
      updateCartStatus: jest.fn().mockResolvedValue(mockCart),
    };

    mockPrismaService = {
      productVariant: {
        findUnique: jest.fn().mockResolvedValue(mockVariant),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
    };

    mockSecurityAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        CartValidationService,
        { provide: CartsRepository, useValue: mockCartsRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('should return active cart for user', async () => {
    const result = await service.getCart('user_1');
    expect(result.id).toBe('cart_1');
    expect(result.items).toHaveLength(1);
    expect(result.totals.grandTotal).toBe(999.98);
  });

  it('should add item to cart with server-side price snapshotting', async () => {
    const result = await service.addItemToCart('user_1', {
      variantId: 'var_1',
      quantity: 2,
    });

    expect(mockCartsRepository.upsertItem).toHaveBeenCalledWith(
      'cart_1',
      'var_1',
      2,
      499.99,
      'EGP',
      100,
    );
    expect(result.id).toBe('cart_1');
  });

  it('should reject adding out-of-stock variant', async () => {
    mockPrismaService.productVariant.findUnique.mockResolvedValueOnce({
      ...mockVariant,
      inventory: { onHandQuantity: 0, reservedQuantity: 0, status: 'OUT_OF_STOCK' },
    });

    await expect(
      service.addItemToCart('user_1', { variantId: 'var_1', quantity: 1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject adding item from suspended seller/store', async () => {
    mockPrismaService.productVariant.findUnique.mockResolvedValueOnce({
      ...mockVariant,
      product: {
        ...mockVariant.product,
        store: { ...mockVariant.product.store, status: 'SUSPENDED' },
      },
    });

    await expect(
      service.addItemToCart('user_1', { variantId: 'var_1', quantity: 1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update item quantity in cart', async () => {
    const result = await service.updateCartItemQuantity('user_1', 'item_1', { quantity: 5 });
    expect(mockCartsRepository.updateItemQuantity).toHaveBeenCalledWith('item_1', 5);
    expect(result.id).toBe('cart_1');
  });

  it('should clear cart items', async () => {
    await service.clearCart('user_1');
    expect(mockCartsRepository.clearCart).toHaveBeenCalledWith('cart_1');
  });
});
