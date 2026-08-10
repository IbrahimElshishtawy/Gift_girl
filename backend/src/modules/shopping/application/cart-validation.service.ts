import { Injectable } from '@nestjs/common';
import { InventoryEntity } from '../../inventory/domain/inventory.entity';

export type CartValidationIssueCode =
  | 'PRODUCT_UNAVAILABLE'
  | 'STORE_UNAVAILABLE'
  | 'SELLER_UNAVAILABLE'
  | 'VARIANT_UNAVAILABLE'
  | 'OUT_OF_STOCK'
  | 'INSUFFICIENT_STOCK'
  | 'PRICE_CHANGED';

export interface CartValidationIssue {
  itemId: string;
  variantId: string;
  code: CartValidationIssueCode;
  message: string;
  details?: Record<string, any>;
}

export interface CartValidationResult {
  valid: boolean;
  issues: CartValidationIssue[];
}

@Injectable()
export class CartValidationService {
  validateCart(cartWithItems: any): CartValidationResult {
    const issues: CartValidationIssue[] = [];
    const items = cartWithItems?.items || [];

    for (const item of items) {
      const v = item.variant;
      if (!v) {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'VARIANT_UNAVAILABLE',
          message: 'The requested product variant no longer exists.',
        });
        continue;
      }

      if (v.status !== 'ACTIVE') {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'VARIANT_UNAVAILABLE',
          message: `Variant SKU '${v.sku}' is inactive or archived.`,
        });
      }

      const p = v.product;
      if (!p || p.status !== 'PUBLISHED') {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'PRODUCT_UNAVAILABLE',
          message: `Product '${p?.name || 'Unknown'}' is not currently published.`,
        });
      }

      const st = p?.store;
      if (!st || st.status !== 'ACTIVE') {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'STORE_UNAVAILABLE',
          message: `Store '${st?.name || 'Unknown'}' is suspended or inactive.`,
        });
      }

      const sel = st?.seller;
      if (!sel || sel.status !== 'ACTIVE') {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'SELLER_UNAVAILABLE',
          message: `Seller account is suspended or inactive.`,
        });
      }

      // Price change validation
      const currentPrice = v.price ? Number(v.price) : Number(p?.basePrice || 0);
      const snapshotPrice = Number(item.unitPriceSnapshot);
      if (currentPrice !== snapshotPrice) {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'PRICE_CHANGED',
          message: `Price for variant '${v.sku}' has changed from ${snapshotPrice} to ${currentPrice}.`,
          details: { snapshotPrice, currentPrice },
        });
      }

      // Inventory availability check
      const inv = v.inventory;
      const onHand = inv?.onHandQuantity || 0;
      const reserved = inv?.reservedQuantity || 0;
      const available = InventoryEntity.calculateAvailable(onHand, reserved);

      if (!inv || inv.status === 'OUT_OF_STOCK' || available <= 0) {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'OUT_OF_STOCK',
          message: `Variant '${v.sku}' is currently out of stock.`,
        });
      } else if (available < item.quantity) {
        issues.push({
          itemId: item.id,
          variantId: item.variantId,
          code: 'INSUFFICIENT_STOCK',
          message: `Requested quantity (${item.quantity}) exceeds available stock (${available}).`,
          details: { requestedQuantity: item.quantity, availableStock: available },
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
