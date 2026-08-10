import { Cart, CartStatus } from '@prisma/client';
import { CartItemEntity } from './cart-item.entity';

export interface CartStoreGroup {
  store: {
    id: string;
    name: string;
    slug: string;
  };
  seller: {
    id: string;
    displayName: string;
  };
  items: CartItemEntity[];
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  totalQuantity: number;
  itemCount: number;
}

export class CartEntity {
  id!: string;
  userId!: string | null;
  status!: CartStatus;
  currency!: string;
  expiresAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;
  items!: CartItemEntity[];
  stores!: CartStoreGroup[];
  totals!: CartTotals;

  static fromPrisma(prismaCart: Cart & { items?: any[] }): CartEntity {
    const entity = new CartEntity();
    entity.id = prismaCart.id;
    entity.userId = prismaCart.userId;
    entity.status = prismaCart.status;
    entity.currency = prismaCart.currency || 'EGP';
    entity.expiresAt = prismaCart.expiresAt;
    entity.createdAt = prismaCart.createdAt;
    entity.updatedAt = prismaCart.updatedAt;

    const rawItems = prismaCart.items || [];
    entity.items = rawItems.map((item) => CartItemEntity.fromPrisma(item));

    // Group items by store / seller
    const storeMap = new Map<string, CartStoreGroup>();

    let subtotal = 0;
    let totalQuantity = 0;

    for (const item of entity.items) {
      subtotal += item.lineTotal;
      totalQuantity += item.quantity;

      const storeId = item.store?.id || 'unknown_store';
      if (!storeMap.has(storeId)) {
        storeMap.set(storeId, {
          store: item.store || { id: 'unknown', name: 'Unknown Store', slug: 'unknown' },
          seller: item.seller || { id: 'unknown', displayName: 'Unknown Seller' },
          items: [],
        });
      }
      storeMap.get(storeId)!.items.push(item);
    }

    subtotal = Number(subtotal.toFixed(2));

    entity.stores = Array.from(storeMap.values());
    entity.totals = {
      subtotal,
      discount: 0,
      tax: 0,
      shipping: 0,
      grandTotal: subtotal,
      totalQuantity,
      itemCount: entity.items.length,
    };

    return entity;
  }
}
