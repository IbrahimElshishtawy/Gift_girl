import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { SellersModule } from '../sellers/sellers.module';
import { RbacModule } from '../rbac/rbac.module';

import { CategoriesRepository } from './infrastructure/categories.repository';
import { BrandsRepository } from './infrastructure/brands.repository';
import { ProductsRepository } from './infrastructure/products.repository';
import { ProductVariantsRepository } from './infrastructure/product-variants.repository';

import { CategoriesService } from './application/categories.service';
import { BrandsService } from './application/brands.service';
import { ProductsSellerService } from './application/products-seller.service';
import { ProductsAdminService } from './application/products-admin.service';
import { ProductsPublicService } from './application/products-public.service';

import { AdminCategoriesController } from './presentation/admin-categories.controller';
import { PublicCategoriesController } from './presentation/public-categories.controller';
import { AdminBrandsController } from './presentation/admin-brands.controller';
import { SellerProductsController } from './presentation/seller-products.controller';
import { AdminProductsController } from './presentation/admin-products.controller';
import { PublicProductsController } from './presentation/public-products.controller';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, SellersModule, RbacModule],
  providers: [
    CategoriesRepository,
    BrandsRepository,
    ProductsRepository,
    ProductVariantsRepository,
    CategoriesService,
    BrandsService,
    ProductsSellerService,
    ProductsAdminService,
    ProductsPublicService,
  ],
  controllers: [
    AdminCategoriesController,
    PublicCategoriesController,
    AdminBrandsController,
    SellerProductsController,
    AdminProductsController,
    PublicProductsController,
  ],
  exports: [
    CategoriesRepository,
    BrandsRepository,
    ProductsRepository,
    ProductVariantsRepository,
    CategoriesService,
    BrandsService,
    ProductsSellerService,
    ProductsAdminService,
    ProductsPublicService,
  ],
})
export class CatalogModule {}
