import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { InventoryModule } from '../inventory/inventory.module';

import { CartsRepository } from './infrastructure/carts.repository';
import { WishlistsRepository } from './infrastructure/wishlists.repository';

import { CartValidationService } from './application/cart-validation.service';
import { CartService } from './application/cart.service';
import { GuestCartService } from './application/guest-cart.service';
import { WishlistService } from './application/wishlist.service';

import { CartController } from './presentation/cart.controller';
import { GuestCartController } from './presentation/guest-cart.controller';
import { WishlistController } from './presentation/wishlist.controller';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    forwardRef(() => AuthModule),
    forwardRef(() => RbacModule),
    forwardRef(() => InventoryModule),
  ],
  controllers: [CartController, GuestCartController, WishlistController],
  providers: [
    CartsRepository,
    WishlistsRepository,
    CartValidationService,
    CartService,
    GuestCartService,
    WishlistService,
  ],
  exports: [
    CartsRepository,
    WishlistsRepository,
    CartValidationService,
    CartService,
    GuestCartService,
    WishlistService,
  ],
})
export class ShoppingModule {}
