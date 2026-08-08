import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { PasswordHasherService } from './infrastructure/password-hasher.service';
import { JwtAuthService } from './infrastructure/jwt-auth.service';
import { SessionService } from './infrastructure/session.service';
import { AuthRateLimiterService } from './infrastructure/auth-rate-limiter.service';
import { BruteForceProtectionService } from './infrastructure/brute-force.service';
import { SecurityAuditService } from './infrastructure/security-audit.service';
import { MockNotificationProvider } from './infrastructure/mock-notification.provider';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { PermissionsGuard } from './presentation/guards/permissions.guard';

@Module({
  imports: [forwardRef(() => UsersModule), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    JwtAuthService,
    SessionService,
    AuthRateLimiterService,
    BruteForceProtectionService,
    SecurityAuditService,
    {
      provide: 'NOTIFICATION_PROVIDER',
      useClass: MockNotificationProvider,
    },
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
    PasswordHasherService,
    JwtAuthService,
    SessionService,
    SecurityAuditService,
  ],
})
export class AuthModule {}
