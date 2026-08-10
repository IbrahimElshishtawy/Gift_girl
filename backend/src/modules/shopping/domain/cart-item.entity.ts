import { CartItem } from '@prisma/client';

export class CartItemEntity {
  id!: string;
  cartId!: string;
  variantId!: string;
  quantity!: number;
  unitPriceSnapshot!: number;
  lineTotal!: number;
  currency!: string;
  createdAt!: Date;
  updatedAt!: Date;

  product?: {
    id: string;
    name: string;
    slug: string;
  };
  variant?: {
    id: string;
    sku: string;
    options?: any[];
  };
  store?: {
    id: string;
    name: string;
    slug: string;
  };
  seller?: {
    id: string;
    displayName: string;
  };
  primaryImage?: string | null;

  static fromPrisma(prismaItem: CartItem & any): CartItemEntity {
    const entity = new CartItemEntity();
    entity.id = prismaItem.id;
    entity.cartId = prismaItem.cartId;
    entity.variantId = prismaItem.variantId;
    entity.quantity = prismaItem.quantity;
    const price = Number(prismaItem.unitPriceSnapshot);
    entity.unitPriceSnapshot = price;
    entity.lineTotal = Number((price * prismaItem.quantity).toFixed(2));
    entity.currency = prismaItem.currency || 'EGP';
    entity.createdAt = prismaItem.createdAt;
    entity.updatedAt = prismaItem.updatedAt;

    if (prismaItem.variant) {
      const v = prismaItem.variant;
      const p = v.product;
      const st = p?.store;
      const sel = st?.seller;

      entity.variant = {
        id: v.id,
        sku: v.sku,
        options: v.optionValues?.map((ov: any) => ({
          optionName: ov.optionValue?.option?.name,
          value: ov.optionValue?.value,
        })),
      };

      if (p) {
        entity.product = {
          id: p.id,
          name: p.name,
          slug: p.slug,
        };
        entity.primaryImage = p.media?.find((m: any) => m.isPrimary)?.url || p.media?.[0]?.url || null;
      }

      if (st) {
        entity.store = {
          id: st.id,
          name: st.name,
          slug: st.slug,
        };
      }

      if (sel) {
        entity.seller = {
          id: sel.id,
          displayName: sel.businessName || sel.id,
        };
      }
    }

    return entity;
  }
}
