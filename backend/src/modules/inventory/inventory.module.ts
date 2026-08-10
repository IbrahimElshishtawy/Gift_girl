import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';
import { RbacModule } from '../rbac/rbac.module';
import { InventoryRepository } from './infrastructure/inventory.repository';
import { InventoryService } from './application/inventory.service';
import { InventoryReservationService } from './application/inventory-reservation.service';
import { SellerInventoryController } from './presentation/seller-inventory.controller';
import { AdminInventoryController } from './presentation/admin-inventory.controller';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    forwardRef(() => AuthModule),
    forwardRef(() => SellersModule),
    forwardRef(() => RbacModule),
  ],
  controllers: [SellerInventoryController, AdminInventoryController],
  providers: [InventoryRepository, InventoryService, InventoryReservationService],
  exports: [InventoryRepository, InventoryService, InventoryReservationService],
})
export class InventoryModule {}
