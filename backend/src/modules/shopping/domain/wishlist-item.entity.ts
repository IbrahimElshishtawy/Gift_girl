import { WishlistItem } from '@prisma/client';

export class WishlistItemEntity {
  id!: string;
  wishlistId!: string;
  variantId!: string;
  createdAt!: Date;

  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number | null;
  };
  variant?: {
    id: string;
    sku: string;
    price?: number | null;
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

  static fromPrisma(prismaItem: WishlistItem & any): WishlistItemEntity {
    const entity = new WishlistItemEntity();
    entity.id = prismaItem.id;
    entity.wishlistId = prismaItem.wishlistId;
    entity.variantId = prismaItem.variantId;
    entity.createdAt = prismaItem.createdAt;

    if (prismaItem.variant) {
      const v = prismaItem.variant;
      const p = v.product;
      const st = p?.store;
      const sel = st?.seller;

      entity.variant = {
        id: v.id,
        sku: v.sku,
        price: v.price ? Number(v.price) : null,
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
          price: Number(p.basePrice),
          compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
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
