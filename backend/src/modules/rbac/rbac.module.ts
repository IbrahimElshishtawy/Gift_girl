import { Module, Global } from '@nestjs/common';
import { RbacRepository } from './infrastructure/rbac.repository';
import { RbacSeederService } from './infrastructure/rbac-seeder.service';
import { RbacService } from './application/rbac.service';
import { AdminRbacController } from './presentation/admin-rbac.controller';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [RbacRepository, RbacSeederService, RbacService],
  controllers: [AdminRbacController],
  exports: [RbacService, RbacRepository],
})
export class RbacModule {}
