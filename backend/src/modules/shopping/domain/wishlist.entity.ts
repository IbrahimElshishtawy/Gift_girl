import { Wishlist } from '@prisma/client';
import { WishlistItemEntity } from './wishlist-item.entity';

export class WishlistEntity {
  id!: string;
  userId!: string;
  name!: string;
  createdAt!: Date;
  updatedAt!: Date;
  items!: WishlistItemEntity[];

  static fromPrisma(prismaWishlist: Wishlist & { items?: any[] }): WishlistEntity {
    const entity = new WishlistEntity();
    entity.id = prismaWishlist.id;
    entity.userId = prismaWishlist.userId;
    entity.name = prismaWishlist.name;
    entity.createdAt = prismaWishlist.createdAt;
    entity.updatedAt = prismaWishlist.updatedAt;

    const rawItems = prismaWishlist.items || [];
    entity.items = rawItems.map((item) => WishlistItemEntity.fromPrisma(item));

    return entity;
  }
}
