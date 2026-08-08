import { Module, Global } from '@nestjs/common';
import { RbacRepository } from './infrastructure/rbac.repository';
import { RbacSeederService } from './infrastructure/rbac-seeder.service';
import { RbacService } from './application/rbac.service';
import { AdminRbacController } from './presentation/admin-rbac.controller';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RbacRepository, RbacSeederService, RbacService],
  controllers: [AdminRbacController],
  exports: [RbacService, RbacRepository],
})
export class RbacModule {}
