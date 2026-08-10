import { Test, TestingModule } from '@nestjs/testing';
import { CartValidationService } from './cart-validation.service';

describe('CartValidationService', () => {
  let service: CartValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CartValidationService],
    }).compile();

    service = module.get<CartValidationService>(CartValidationService);
  });

  const validCart = {
    id: 'cart_1',
    items: [
      {
        id: 'item_1',
        variantId: 'var_1',
        quantity: 2,
        unitPriceSnapshot: 499.99,
        variant: {
          id: 'var_1',
          sku: 'DRESS-BLK-M',
          status: 'ACTIVE',
          price: 499.99,
          product: {
            id: 'prod_1',
            name: 'Silk Dress',
            status: 'PUBLISHED',
            store: {
              id: 'store_1',
              name: 'Lotus Store',
              status: 'ACTIVE',
              seller: {
                id: 'seller_1',
                status: 'ACTIVE',
              },
            },
          },
          inventory: {
            onHandQuantity: 10,
            reservedQuantity: 0,
            status: 'IN_STOCK',
          },
        },
      },
    ],
  };

  it('should validate a healthy cart with 0 issues', () => {
    const result = service.validateCart(validCart);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect price change', () => {
    const cartWithPriceChange = {
      ...validCart,
      items: [
        {
          ...validCart.items[0],
          unitPriceSnapshot: 399.99, // Snapshot 399.99 vs current 499.99
        },
      ],
    };

    const result = service.validateCart(cartWithPriceChange);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('PRICE_CHANGED');
  });

  it('should detect out of stock and insufficient stock items', () => {
    const cartOos = {
      ...validCart,
      items: [
        {
          ...validCart.items[0],
          quantity: 5,
          variant: {
            ...validCart.items[0].variant,
            inventory: {
              onHandQuantity: 2, // 2 available vs 5 requested
              reservedQuantity: 0,
              status: 'IN_STOCK',
            },
          },
        },
      ],
    };

    const result = service.validateCart(cartOos);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe('INSUFFICIENT_STOCK');
  });

  it('should detect suspended store and unpublished product', () => {
    const cartSuspended = {
      ...validCart,
      items: [
        {
          ...validCart.items[0],
          variant: {
            ...validCart.items[0].variant,
            product: {
              ...validCart.items[0].variant.product,
              status: 'DRAFT',
              store: {
                ...validCart.items[0].variant.product.store,
                status: 'SUSPENDED',
              },
            },
          },
        },
      ],
    };

    const result = service.validateCart(cartSuspended);
    expect(result.valid).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('PRODUCT_UNAVAILABLE');
    expect(codes).toContain('STORE_UNAVAILABLE');
  });
});
