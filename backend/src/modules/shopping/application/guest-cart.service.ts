import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CartsRepository } from '../infrastructure/carts.repository';
import { CartEntity } from '../domain/cart.entity';
import { AddToCartDto } from '../presentation/dto/add-to-cart.dto';
import { UpdateCartItemDto } from '../presentation/dto/update-cart-item.dto';
import { InventoryEntity } from '../../inventory/domain/inventory.entity';
import { CartStatus } from '@prisma/client';
import { MAX_CART_ITEM_QUANTITY } from './cart.service';

@Injectable()
export class GuestCartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartsRepository: CartsRepository,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  async createGuestCart(): Promise<{ token: string; cart: CartEntity }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = this.hashToken(rawToken);

    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 days
    const cart = await this.cartsRepository.createCart({
      guestTokenHash: hash,
      status: CartStatus.ACTIVE,
      currency: 'EGP',
      expiresAt,
    });

    return {
      token: rawToken,
      cart: CartEntity.fromPrisma(cart),
    };
  }

  async getGuestCartByToken(token: string): Promise<CartEntity> {
    const hash = this.hashToken(token);
    const cart = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    if (!cart) {
      throw new NotFoundException('Guest cart not found or expired.');
    }
    return CartEntity.fromPrisma(cart);
  }

  async addItemToGuestCart(token: string, dto: AddToCartDto): Promise<CartEntity> {
    const hash = this.hashToken(token);
    let cart = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    if (!cart) {
      throw new NotFoundException('Guest cart not found or expired.');
    }

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

    const priceSnapshot = variant.price ? Number(variant.price) : Number(product.basePrice);

    await this.cartsRepository.upsertItem(
      cart.id,
      dto.variantId,
      dto.quantity,
      priceSnapshot,
      'EGP',
      MAX_CART_ITEM_QUANTITY,
    );

    const updated = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    return CartEntity.fromPrisma(updated!);
  }

  async updateGuestCartItemQuantity(
    token: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartEntity> {
    const hash = this.hashToken(token);
    const cart = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    if (!cart) throw new NotFoundException('Guest cart not found or expired.');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Cart item '${itemId}' not found in your guest cart.`);
    }

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

    const updated = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    return CartEntity.fromPrisma(updated!);
  }

  async removeGuestCartItem(token: string, itemId: string): Promise<CartEntity> {
    const hash = this.hashToken(token);
    const cart = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    if (!cart) throw new NotFoundException('Guest cart not found or expired.');

    const item = cart.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException(`Cart item '${itemId}' not found in your guest cart.`);
    }

    await this.cartsRepository.removeItem(itemId);

    const updated = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    return CartEntity.fromPrisma(updated!);
  }

  async clearGuestCart(token: string): Promise<CartEntity> {
    const hash = this.hashToken(token);
    const cart = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    if (!cart) throw new NotFoundException('Guest cart not found or expired.');

    await this.cartsRepository.clearCart(cart.id);

    const updated = await this.cartsRepository.findActiveByGuestTokenHash(hash);
    return CartEntity.fromPrisma(updated!);
  }
}
