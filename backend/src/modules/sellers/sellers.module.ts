import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuthModule } from '../auth/auth.module';

// Repositories
import { SellersRepository } from './infrastructure/sellers.repository';
import { SellerApplicationsRepository } from './infrastructure/seller-applications.repository';
import { SellerDocumentsRepository } from './infrastructure/seller-documents.repository';
import { StoresRepository } from './infrastructure/stores.repository';
import { SellerStaffRepository } from './infrastructure/seller-staff.repository';

// Services
import { SellerOnboardingService } from './application/seller-onboarding.service';
import { SellersService } from './application/sellers.service';
import { StoresService } from './application/stores.service';

// Controllers
import { SellersController } from './presentation/sellers.controller';
import { SellerStoresController } from './presentation/seller-stores.controller';
import { SellerStaffController } from './presentation/seller-staff.controller';
import { AdminSellersController } from './presentation/admin-sellers.controller';
import { AdminStoresController } from './presentation/admin-stores.controller';
import { PublicStoresController } from './presentation/public-stores.controller';

@Module({
  imports: [DatabaseModule, RbacModule, AuthModule],
  providers: [
    SellersRepository,
    SellerApplicationsRepository,
    SellerDocumentsRepository,
    StoresRepository,
    SellerStaffRepository,
    SellerOnboardingService,
    SellersService,
    StoresService,
  ],
  controllers: [
    SellersController,
    SellerStoresController,
    SellerStaffController,
    AdminSellersController,
    AdminStoresController,
    PublicStoresController,
  ],
  exports: [
    SellersService,
    SellerOnboardingService,
    StoresService,
    SellersRepository,
    StoresRepository,
  ],
})
export class SellersModule {}
