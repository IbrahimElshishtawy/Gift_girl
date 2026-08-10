import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Cart, CartItem, CartStatus, Prisma } from '@prisma/client';

export const CART_INCLUDE_SPEC = {
  items: {
    include: {
      variant: {
        include: {
          product: {
            include: {
              store: {
                include: {
                  seller: true,
                },
              },
              media: true,
            },
          },
          optionValues: {
            include: {
              optionValue: {
                include: {
                  option: true,
                },
              },
            },
          },
          inventory: true,
        },
      },
    },
  },
};

@Injectable()
export class CartsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByUserId(userId: string): Promise<(Cart & { items: any[] }) | null> {
    return this.prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: CART_INCLUDE_SPEC,
      orderBy: { updatedAt: 'desc' },
    }) as Promise<(Cart & { items: any[] }) | null>;
  }

  async findActiveByGuestTokenHash(hash: string): Promise<(Cart & { items: any[] }) | null> {
    return this.prisma.cart.findFirst({
      where: {
        guestTokenHash: hash,
        status: CartStatus.ACTIVE,
      },
      include: CART_INCLUDE_SPEC,
    }) as Promise<(Cart & { items: any[] }) | null>;
  }

  async createCart(
    data: Prisma.CartCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Cart & { items: any[] }> {
    const client = tx || this.prisma;
    return client.cart.create({
      data,
      include: CART_INCLUDE_SPEC,
    }) as Promise<Cart & { items: any[] }>;
  }

  async upsertItem(
    cartId: string,
    variantId: string,
    quantityToAdd: number,
    unitPriceSnapshot: number,
    currency = 'EGP',
    maxItemQuantity = 100,
    tx?: Prisma.TransactionClient,
  ): Promise<CartItem> {
    const client = tx || this.prisma;

    const existing = await client.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId,
          variantId,
        },
      },
    });

    if (existing) {
      const newQuantity = Math.min(maxItemQuantity, existing.quantity + quantityToAdd);
      return client.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: newQuantity,
          unitPriceSnapshot,
          currency,
        },
      });
    }

    return client.cartItem.create({
      data: {
        cart: { connect: { id: cartId } },
        variant: { connect: { id: variantId } },
        quantity: Math.min(maxItemQuantity, quantityToAdd),
        unitPriceSnapshot,
        currency,
      },
    });
  }

  async updateItemQuantity(
    itemId: string,
    quantity: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CartItem> {
    const client = tx || this.prisma;
    return client.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  async removeItem(itemId: string, tx?: Prisma.TransactionClient): Promise<CartItem | null> {
    const client = tx || this.prisma;
    return client.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCart(cartId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx || this.prisma;
    const res = await client.cartItem.deleteMany({
      where: { cartId },
    });
    return res.count;
  }

  async updateCartStatus(
    cartId: string,
    status: CartStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Cart> {
    const client = tx || this.prisma;
    return client.cart.update({
      where: { id: cartId },
      data: { status },
    });
  }
}
