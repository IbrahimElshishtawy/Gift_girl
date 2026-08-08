import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { UsersService } from '../../users/application/users.service';
import { UserEntity } from '../../users/domain/user.entity';
import authConfig from '../../../config/auth.config';
import { SecurityAuditService } from './security-audit.service';
import { SecurityEventType } from '@prisma/client';

@Injectable()
export class BruteForceProtectionService {
  private readonly logger = new Logger(BruteForceProtectionService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly securityAuditService: SecurityAuditService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async checkAccountLock(user: UserEntity): Promise<void> {
    if (user.lockoutUntil) {
      if (new Date() < user.lockoutUntil) {
        this.logger.warn(`Attempted login on locked account: User [${user.id}]`);
        throw new HttpException(
          'Account is temporarily locked due to repeated failed login attempts. Please try again later.',
          HttpStatus.UNAUTHORIZED,
        );
      } else {
        // Lockout expired, reset counter
        await this.usersService.resetFailedLoginAttempts(user.id);
      }
    }
  }

  async handleFailedLogin(
    user: UserEntity | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    if (!user) return;

    const maxAttempts = this.config.maxLoginAttempts;
    const lockMinutes = this.config.lockoutDurationMinutes;

    const attempts = user.failedLoginAttempts + 1;
    let lockoutUntil: Date | undefined;

    if (attempts >= maxAttempts) {
      lockoutUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      this.logger.warn(`Account locked due to brute-force threshold: User [${user.id}]`);

      await this.securityAuditService.logEvent(
        SecurityEventType.ACCOUNT_LOCKED,
        user.id,
        ipAddress,
        userAgent,
        { attempts, lockMinutes },
      );
    }

    await this.usersService.incrementFailedLogin(user.id, lockoutUntil);
  }

  async handleSuccessfulLogin(user: UserEntity): Promise<void> {
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.usersService.resetFailedLoginAttempts(user.id);
    }
  }
}
