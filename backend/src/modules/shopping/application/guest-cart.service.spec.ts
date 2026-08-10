import { Test, TestingModule } from '@nestjs/testing';
import { GuestCartService } from './guest-cart.service';
import { CartsRepository } from '../infrastructure/carts.repository';
import { PrismaService } from '../../../database/prisma.service';
import { CartStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('GuestCartService', () => {
  let service: GuestCartService;
  let mockCartsRepository: any;
  let mockPrismaService: any;

  const mockCart = {
    id: 'guest_cart_1',
    userId: null,
    guestTokenHash: 'some_hash',
    status: CartStatus.ACTIVE,
    currency: 'EGP',
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  beforeEach(async () => {
    mockCartsRepository = {
      createCart: jest.fn().mockResolvedValue(mockCart),
      findActiveByGuestTokenHash: jest.fn().mockResolvedValue(mockCart),
      upsertItem: jest.fn().mockResolvedValue({ id: 'item_1' }),
      updateItemQuantity: jest.fn().mockResolvedValue({ id: 'item_1' }),
      removeItem: jest.fn().mockResolvedValue({ id: 'item_1' }),
      clearCart: jest.fn().mockResolvedValue(1),
    };

    mockPrismaService = {
      productVariant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestCartService,
        { provide: CartsRepository, useValue: mockCartsRepository },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GuestCartService>(GuestCartService);
  });

  it('should create guest cart and return secure raw token', async () => {
    const result = await service.createGuestCart();
    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(64); // 32-byte hex token is 64 chars
    expect(result.cart.id).toBe('guest_cart_1');
    expect(mockCartsRepository.createCart).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CartStatus.ACTIVE,
      }),
    );
  });

  it('should get guest cart by token', async () => {
    const result = await service.getGuestCartByToken('fake_token_123');
    expect(result.id).toBe('guest_cart_1');
    expect(mockCartsRepository.findActiveByGuestTokenHash).toHaveBeenCalled();
  });

  it('should throw NotFoundException for invalid guest token', async () => {
    mockCartsRepository.findActiveByGuestTokenHash.mockResolvedValueOnce(null);
    await expect(service.getGuestCartByToken('invalid_token')).rejects.toThrow(
      NotFoundException,
    );
  });
});
