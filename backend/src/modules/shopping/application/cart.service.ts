import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CartsRepository } from '../infrastructure/carts.repository';
import { CartValidationService } from './cart-validation.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { CartEntity } from '../domain/cart.entity';
import { AddToCartDto } from '../presentation/dto/add-to-cart.dto';
import { UpdateCartItemDto } from '../presentation/dto/update-cart-item.dto';
import { InventoryEntity } from '../../inventory/domain/inventory.entity';
import { CartStatus, SecurityEventType } from '@prisma/client';

export const MAX_CART_ITEM_QUANTITY = 100;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartsRepository: CartsRepository,
    private readonly cartValidationService: CartValidationService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getOrCreateActiveCart(userId: string): Promise<CartEntity> {
    let cart = await this.cartsRepository.findActiveByUserId(userId);
    if (!cart) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
      cart = await this.cartsRepository.createCart({
        user: { connect: { id: userId } },
        status: CartStatus.ACTIVE,
        currency: 'EGP',
        expiresAt,
      });

      await this.securityAuditService.logEvent(
        SecurityEventType.CART_CREATED,
        userId,
        undefined,
        undefined,
        { cartId: cart.id },
      );
    }
    return CartEntity.fromPrisma(cart);
  }

  async getCart(userId: string): Promise<CartEntity> {
    return this.getOrCreateActiveCart(userId);
  }

  async addItemToCart(
    userId: string,
    dto: AddToCartDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CartEntity> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: {
        product: {
          include: {
            store: {
              include: {
                seller: true,
              },
            },
          },
        },
        inventory: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant '${dto.variantId}' not found.`);
    }

    if (variant.status !== 'ACTIVE') {
      throw new BadRequestException(`Product variant '${dto.variantId}' is inactive.`);
    }

    const product = variant.product;
    if (!product || product.status !== 'PUBLISHED') {
      throw new BadRequestException(`Product '${product?.name || dto.variantId}' is not available.`);
    }

    const store = product.store;
    if (!store || store.status !== 'ACTIVE') {
      throw new BadRequestException(`Store for product '${product.name}' is inactive or suspended.`);
    }

    const seller = store.seller;
    if (!seller || seller.status !== 'ACTIVE') {
      throw new BadRequestException(`Seller account is inactive or suspended.`);
    }

    // Check inventory availability
    const inv = variant.inventory;
    const available = InventoryEntity.calculateAvailable(
      inv?.onHandQuantity || 0,
      inv?.reservedQuantity || 0,
    );

    if (!inv || inv.status === 'OUT_OF_STOCK' || available <= 0) {
      throw new BadRequestException(`Variant '${variant.sku}' is currently out of stock.`);
    }

    if (available < dto.quantity) {
      throw new BadRequestException(
        `Requested quantity (${dto.quantity}) exceeds available stock (${available}).`,
      );
    }

    // Server-controlled unit price snapshot
    const priceSnapshot = variant.price ? Number(variant.price) : Number(product.basePrice);

    let cart = await this.cartsRepository.findActiveByUserId(userId);
    if (!cart) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      cart = await this.cartsRepository.createCart({
        user: { connect: { id: userId } },
        status: CartStatus.ACTIVE,
        currency: 'EGP',
        expiresAt,
      });

      await this.securityAuditService.logEvent(
        SecurityEventType.CART_CREATED,
        userId,
        ipAddress,
        userAgent,
        { cartId: cart.id },
      );
    }

    await this.cartsRepository.upsertItem(
      cart.id,
      dto.variantId,
      dto.quantity,
      priceSnapshot,
      'EGP',
      MAX_CART_ITEM_QUANTITY,
    );

    const updatedCart = await this.cartsRepository.findActiveByUserId(userId);
    return CartEntity.fromPrisma(updatedCart!);
  }

  async updateCartItemQuantity(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    const cart = await this.cartsRepository.findActiveByUserId(userId);
    if (!cart) throw new NotFoundException('Active cart not found.');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Cart item '${itemId}' not found in your active cart.`);
    }

    // Validate available stock
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: item.variantId },
      include: { inventory: true },
    });

    if (variant && variant.inventory) {
      const available = InventoryEntity.calculateAvailable(
        variant.inventory.onHandQuantity,
        variant.inventory.reservedQuantity,
      );
      if (available < dto.quantity) {
        throw new BadRequestException(
          `Requested quantity (${dto.quantity}) exceeds available stock (${available}).`,
        );
      }
    }

    await this.cartsRepository.updateItemQuantity(itemId, dto.quantity);

    const updated = await this.cartsRepository.findActiveByUserId(userId);
    return CartEntity.fromPrisma(updated!);
  }

  async removeCartItem(userId: string, itemId: string): Promise<CartEntity> {
    const cart = await this.cartsRepository.findActiveByUserId(userId);
    if (!cart) throw new NotFoundException('Active cart not found.');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Cart item '${itemId}' not found in your active cart.`);
    }

    await this.cartsRepository.removeItem(itemId);

    const updated = await this.cartsRepository.findActiveByUserId(userId);
    return CartEntity.fromPrisma(updated!);
  }

  async clearCart(userId: string, ipAddress?: string, userAgent?: string): Promise<CartEntity> {
    const cart = await this.cartsRepository.findActiveByUserId(userId);
    if (!cart) throw new NotFoundException('Active cart not found.');

    await this.cartsRepository.clearCart(cart.id);

    await this.securityAuditService.logEvent(
      SecurityEventType.CART_CLEARED,
      userId,
      ipAddress,
      userAgent,
      { cartId: cart.id },
    );

    const updated = await this.cartsRepository.findActiveByUserId(userId);
    return CartEntity.fromPrisma(updated!);
  }

  async validateCart(userId: string) {
    const cart = await this.cartsRepository.findActiveByUserId(userId);
    if (!cart) {
      return { valid: true, issues: [] };
    }
    return this.cartValidationService.validateCart(cart);
  }

  async mergeGuestCart(
    userId: string,
    guestToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CartEntity> {
    const hash = crypto.createHash('sha256').update(guestToken.trim()).digest('hex');
    const guestCart = await this.cartsRepository.findActiveByGuestTokenHash(hash);

    const userCartEntity = await this.getOrCreateActiveCart(userId);
    if (!guestCart || guestCart.items.length === 0) {
      return userCartEntity;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        const variant = item.variant;
        if (!variant || variant.status !== 'ACTIVE') continue;
        if (variant.product?.status !== 'PUBLISHED') continue;
        if (variant.product?.store?.status !== 'ACTIVE') continue;

        const priceSnapshot = variant.price
          ? Number(variant.price)
          : Number(variant.product.basePrice);

        await this.cartsRepository.upsertItem(
          userCartEntity.id,
          item.variantId,
          item.quantity,
          priceSnapshot,
          'EGP',
          MAX_CART_ITEM_QUANTITY,
          tx,
        );
      }

      await this.cartsRepository.updateCartStatus(guestCart.id, CartStatus.MERGED, tx);
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.CART_MERGED,
      userId,
      ipAddress,
      userAgent,
      { guestCartId: guestCart.id, userCartId: userCartEntity.id },
    );

    const finalUserCart = await this.cartsRepository.findActiveByUserId(userId);
    return CartEntity.fromPrisma(finalUserCart!);
  }
}
