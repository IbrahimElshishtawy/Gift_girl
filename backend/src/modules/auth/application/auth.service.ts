import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import authConfig from '../../../config/auth.config';
import { PrismaService } from '../../../database/prisma.service';
import { UsersService } from '../../users/application/users.service';
import { PasswordHasherService } from '../infrastructure/password-hasher.service';
import { JwtAuthService } from '../infrastructure/jwt-auth.service';
import { SessionService } from '../infrastructure/session.service';
import { BruteForceProtectionService } from '../infrastructure/brute-force.service';
import { SecurityAuditService } from '../infrastructure/security-audit.service';
import { INotificationProvider } from '../infrastructure/notification-provider.interface';

import { RegisterDto } from '../presentation/dto/register.dto';
import { LoginDto } from '../presentation/dto/login.dto';
import { RefreshTokenDto } from '../presentation/dto/refresh-token.dto';
import { ChangePasswordDto } from '../presentation/dto/change-password.dto';
import { RequestPasswordResetDto } from '../presentation/dto/request-password-reset.dto';
import { ResetPasswordDto } from '../presentation/dto/reset-password.dto';
import { VerifyAccountDto } from '../presentation/dto/verify-account.dto';
import { AuthResponseDto } from '../presentation/dto/auth-response.dto';
import { SecurityEventType, UserStatus, VerificationType } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtAuthService: JwtAuthService,
    private readonly sessionService: SessionService,
    private readonly bruteForceProtection: BruteForceProtectionService,
    private readonly securityAuditService: SecurityAuditService,
    @Inject('NOTIFICATION_PROVIDER')
    private readonly notificationProvider: INotificationProvider,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const passwordHash = await this.passwordHasher.hashPassword(dto.password);

    const user = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
    });

    // Generate single-use verification token
    const rawVerificationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawVerificationToken);

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: dto.email ? VerificationType.EMAIL_VERIFICATION : VerificationType.PHONE_VERIFICATION,
        expiresAt: new Date(Date.now() + this.config.verificationExpirationHours * 60 * 60 * 1000),
      },
    });

    if (dto.email) {
      await this.notificationProvider.sendVerificationToken(
        dto.email,
        rawVerificationToken,
        'EMAIL',
      );
    } else if (dto.phone) {
      await this.notificationProvider.sendVerificationToken(
        dto.phone,
        rawVerificationToken,
        'PHONE',
      );
    }

    await this.securityAuditService.logEvent(
      SecurityEventType.REGISTER,
      user.id,
      ipAddress,
      userAgent,
    );

    // Initial registration session
    const { session, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    const accessToken = this.jwtAuthService.generateAccessToken(user.id, session.id, user.role);

    return {
      user: user.toSafeUser(),
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: 900, // 15 mins
      },
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByIdentity(dto.identity);

    // Generic error handling to prevent account enumeration
    if (!user) {
      this.logger.warn(`Failed login attempt for non-existent identity: ${dto.identity}`);
      throw new UnauthorizedException('Invalid identity credentials.');
    }

    // Check account lockout status
    await this.bruteForceProtection.checkAccountLock(user);

    if (user.status === UserStatus.DISABLED || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended or disabled.');
    }

    const isValidPassword = await this.passwordHasher.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      await this.bruteForceProtection.handleFailedLogin(user, ipAddress, userAgent);
      await this.securityAuditService.logEvent(
        SecurityEventType.LOGIN_FAILED,
        user.id,
        ipAddress,
        userAgent,
      );
      throw new UnauthorizedException('Invalid identity credentials.');
    }

    // Successful login reset
    await this.bruteForceProtection.handleSuccessfulLogin(user);
    await this.usersService.recordSuccessfulLogin(user.id, ipAddress);

    await this.securityAuditService.logEvent(
      SecurityEventType.LOGIN_SUCCESS,
      user.id,
      ipAddress,
      userAgent,
    );

    const { session, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    const accessToken = this.jwtAuthService.generateAccessToken(user.id, session.id, user.role);

    return {
      user: user.toSafeUser(),
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: 900,
      },
    };
  }

  async refresh(
    dto: RefreshTokenDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const rotated = await this.sessionService.rotateRefreshToken(
      dto.refreshToken,
      ipAddress,
      userAgent,
    );

    const user = await this.usersService.findById(rotated.userId);
    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException('User account is invalid or suspended.');
    }

    const newAccessToken = this.jwtAuthService.generateAccessToken(
      user.id,
      rotated.sessionId,
      user.role,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: rotated.rawRefreshToken,
      expiresIn: 900,
    };
  }

  async logout(
    sessionId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.sessionService.revokeSession(sessionId, 'LOGOUT');
    await this.securityAuditService.logEvent(
      SecurityEventType.LOGOUT,
      userId,
      ipAddress,
      userAgent,
    );
  }

  async logoutAll(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.sessionService.revokeAllUserSessions(userId, 'LOGOUT_ALL');
    await this.securityAuditService.logEvent(
      SecurityEventType.LOGOUT_ALL,
      userId,
      ipAddress,
      userAgent,
    );
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User profile not found.');
    }
    return user.toSafeUser();
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const isValidCurrent = await this.passwordHasher.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isValidCurrent) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const isSamePassword = await this.passwordHasher.verifyPassword(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException('New password cannot be identical to current password.');
    }

    const newPasswordHash = await this.passwordHasher.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(userId, newPasswordHash);

    // Revoke all sessions requiring fresh login across devices
    await this.sessionService.revokeAllUserSessions(userId, 'PASSWORD_CHANGE');

    await this.securityAuditService.logEvent(
      SecurityEventType.PASSWORD_CHANGE,
      userId,
      ipAddress,
      userAgent,
    );
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If an account exists matching the provided identity, a password reset code has been sent.',
    };

    const user = await this.usersService.findByIdentity(dto.identity);
    if (!user) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + this.config.passwordResetExpirationMinutes * 60 * 1000),
      },
    });

    const destination = user.email || user.phone;
    if (destination) {
      await this.notificationProvider.sendPasswordResetToken(destination, rawToken);
    }

    await this.securityAuditService.logEvent(
      SecurityEventType.PASSWORD_RESET_REQUEST,
      user.id,
      ipAddress,
      userAgent,
    );

    return genericResponse;
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);

    const resetTokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, isUsed: false },
    });

    if (!resetTokenRecord || new Date() > resetTokenRecord.expiresAt) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const user = await this.usersService.findById(resetTokenRecord.userId);
    if (!user) {
      throw new BadRequestException('User associated with token not found.');
    }

    const newPasswordHash = await this.passwordHasher.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(user.id, newPasswordHash);

    // Mark reset token as used
    await this.prisma.passwordResetToken.update({
      where: { id: resetTokenRecord.id },
      data: { isUsed: true },
    });

    // Revoke active sessions
    await this.sessionService.revokeAllUserSessions(user.id, 'PASSWORD_RESET');

    await this.securityAuditService.logEvent(
      SecurityEventType.PASSWORD_RESET_COMPLETE,
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      message: 'Password has been successfully reset. Please log in with your new password.',
    };
  }

  async verifyAccount(
    dto: VerifyAccountDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashToken(dto.token);

    const record = await this.prisma.verificationToken.findFirst({
      where: { tokenHash, isUsed: false },
    });

    if (!record || new Date() > record.expiresAt) {
      await this.securityAuditService.logEvent(
        SecurityEventType.VERIFICATION_FAILED,
        null,
        ipAddress,
        userAgent,
      );
      throw new BadRequestException('Invalid or expired verification token.');
    }

    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { isUsed: true },
    });

    if (record.type === VerificationType.EMAIL_VERIFICATION) {
      await this.usersService.updateEmailVerified(record.userId, true);
    } else {
      await this.usersService.updatePhoneVerified(record.userId, true);
    }

    await this.securityAuditService.logEvent(
      SecurityEventType.VERIFICATION_SUCCESS,
      record.userId,
      ipAddress,
      userAgent,
    );

    return { message: 'Account identity verification successful.' };
  }
}
