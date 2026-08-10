import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WishlistsRepository } from '../infrastructure/wishlists.repository';
import { CartService } from './cart.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { WishlistEntity } from '../domain/wishlist.entity';
import { CartEntity } from '../domain/cart.entity';
import { AddToWishlistDto } from '../presentation/dto/add-to-wishlist.dto';
import { SecurityEventType } from '@prisma/client';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wishlistsRepository: WishlistsRepository,
    private readonly cartService: CartService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async getUserWishlist(userId: string): Promise<WishlistEntity> {
    const wishlist = await this.wishlistsRepository.findOrCreateByUserId(userId);
    return WishlistEntity.fromPrisma(wishlist);
  }

  async addItemToWishlist(
    userId: string,
    dto: AddToWishlistDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<WishlistEntity> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant '${dto.variantId}' not found.`);
    }

    const wishlist = await this.wishlistsRepository.findOrCreateByUserId(userId);
    await this.wishlistsRepository.addItem(wishlist.id, dto.variantId);

    await this.securityAuditService.logEvent(
      SecurityEventType.WISHLIST_ITEM_ADDED,
      userId,
      ipAddress,
      userAgent,
      { wishlistId: wishlist.id, variantId: dto.variantId },
    );

    const updated = await this.wishlistsRepository.findOrCreateByUserId(userId);
    return WishlistEntity.fromPrisma(updated);
  }

  async removeItemFromWishlist(
    userId: string,
    variantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<WishlistEntity> {
    const wishlist = await this.wishlistsRepository.findOrCreateByUserId(userId);
    await this.wishlistsRepository.removeItem(wishlist.id, variantId);

    await this.securityAuditService.logEvent(
      SecurityEventType.WISHLIST_ITEM_REMOVED,
      userId,
      ipAddress,
      userAgent,
      { wishlistId: wishlist.id, variantId },
    );

    const updated = await this.wishlistsRepository.findOrCreateByUserId(userId);
    return WishlistEntity.fromPrisma(updated);
  }

  async moveWishlistItemToCart(
    userId: string,
    variantId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CartEntity> {
    const wishlist = await this.wishlistsRepository.findOrCreateByUserId(userId);
    const item = wishlist.items.find((i: any) => i.variantId === variantId);

    if (!item) {
      throw new NotFoundException(`Variant '${variantId}' not found in your wishlist.`);
    }

    // Add to cart (this validates product, store, seller, inventory status)
    const cart = await this.cartService.addItemToCart(
      userId,
      { variantId, quantity: 1 },
      ipAddress,
      userAgent,
    );

    // Remove from wishlist
    await this.wishlistsRepository.removeItem(wishlist.id, variantId);

    return cart;
  }
}
