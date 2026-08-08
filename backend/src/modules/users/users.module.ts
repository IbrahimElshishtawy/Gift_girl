import { Module } from '@nestjs/common';
import { UsersRepository } from './infrastructure/users.repository';
import { UserAddressRepository } from './infrastructure/user-address.repository';
import { UsersService } from './application/users.service';
import { UserProfileService } from './application/user-profile.service';
import { UserAddressService } from './application/user-address.service';
import { UsersMeController } from './presentation/users-me.controller';
import { AdminUsersController } from './presentation/admin-users.controller';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [
    UsersRepository,
    UserAddressRepository,
    UsersService,
    UserProfileService,
    UserAddressService,
  ],
  controllers: [UsersMeController, AdminUsersController],
  exports: [UsersService, UsersRepository, UserProfileService, UserAddressService],
})
export class UsersModule {}
