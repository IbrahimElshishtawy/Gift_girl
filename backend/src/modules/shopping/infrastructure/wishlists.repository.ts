import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Wishlist, WishlistItem, Prisma } from '@prisma/client';

export const WISHLIST_INCLUDE_SPEC = {
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
    orderBy: { createdAt: 'desc' as const },
  },
};

@Injectable()
export class WishlistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateByUserId(userId: string): Promise<Wishlist & { items: any[] }> {
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
      include: WISHLIST_INCLUDE_SPEC,
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: {
          user: { connect: { id: userId } },
          name: 'My Wishlist',
        },
        include: WISHLIST_INCLUDE_SPEC,
      });
    }

    return wishlist as Wishlist & { items: any[] };
  }

  async addItem(wishlistId: string, variantId: string, tx?: Prisma.TransactionClient): Promise<WishlistItem> {
    const client = tx || this.prisma;
    const existing = await client.wishlistItem.findUnique({
      where: {
        wishlistId_variantId: {
          wishlistId,
          variantId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return client.wishlistItem.create({
      data: {
        wishlist: { connect: { id: wishlistId } },
        variant: { connect: { id: variantId } },
      },
    });
  }

  async removeItem(wishlistId: string, variantId: string, tx?: Prisma.TransactionClient): Promise<WishlistItem | null> {
    const client = tx || this.prisma;
    const existing = await client.wishlistItem.findUnique({
      where: {
        wishlistId_variantId: {
          wishlistId,
          variantId,
        },
      },
    });

    if (!existing) return null;

    return client.wishlistItem.delete({
      where: { id: existing.id },
    });
  }
}
