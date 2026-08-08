import { Injectable, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import authConfig from '../../../config/auth.config';
import { SecurityAuditService } from './security-audit.service';
import { randomUUID, createHash } from 'crypto';
import { AuthSession, SecurityEventType } from '@prisma/client';

export interface CreatedSessionResult {
  session: AuthSession;
  rawRefreshToken: string;
}

export interface RotatedSessionResult {
  sessionId: string;
  userId: string;
  rawRefreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly securityAuditService: SecurityAuditService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  private hashToken(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private parseRefreshToken(rawRefreshToken: string): { sessionId: string; secret: string } {
    const parts = rawRefreshToken.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedException('Malformed refresh token structure.');
    }
    return { sessionId: parts[0], secret: parts[1] };
  }

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: string,
  ): Promise<CreatedSessionResult> {
    const rawSecret = randomUUID();
    const familyId = randomUUID();
    const refreshTokenHash = this.hashToken(rawSecret);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash,
        familyId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceInfo: deviceInfo || null,
        expiresAt,
      },
    });

    const rawRefreshToken = `${session.id}.${rawSecret}`;

    // Cache active session status in Redis (TTL: 7 days)
    await this.redisService.set(
      `session:${session.id}`,
      JSON.stringify({ userId: session.userId, isRevoked: false }),
      7 * 24 * 60 * 60,
    );

    return { session, rawRefreshToken };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RotatedSessionResult> {
    const { sessionId, secret } = this.parseRefreshToken(rawRefreshToken);
    const providedHash = this.hashToken(secret);

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found or invalid.');
    }

    // Token Reuse / Revoked Token Detection Strategy
    if (session.isRevoked || session.refreshTokenHash !== providedHash) {
      this.logger.warn(
        `SECURITY ALERT: Refresh token reuse/tampering detected on session [${session.id}] family [${session.familyId}]`,
      );

      // Revoke all sessions in the family
      await this.revokeSessionFamily(session.familyId, 'TOKEN_REUSE_DETECTED');

      await this.securityAuditService.logEvent(
        SecurityEventType.TOKEN_REUSE_DETECTED,
        session.userId,
        ipAddress,
        userAgent,
        { sessionId, familyId: session.familyId },
      );

      throw new UnauthorizedException(
        'Security breach detected: Invalid refresh token. All sessions revoked.',
      );
    }

    if (new Date() > session.expiresAt) {
      await this.revokeSession(session.id, 'EXPIRED');
      throw new UnauthorizedException('Refresh token expired. Please login again.');
    }

    // Issue new secret for rotation
    const newRawSecret = randomUUID();
    const newRefreshTokenHash = this.hashToken(newRawSecret);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updatedSession = await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
        ipAddress: ipAddress || session.ipAddress,
        userAgent: userAgent || session.userAgent,
      },
    });

    const newRawRefreshToken = `${updatedSession.id}.${newRawSecret}`;

    // Update Redis cache
    await this.redisService.set(
      `session:${updatedSession.id}`,
      JSON.stringify({ userId: updatedSession.userId, isRevoked: false }),
      7 * 24 * 60 * 60,
    );

    return {
      sessionId: updatedSession.id,
      userId: updatedSession.userId,
      rawRefreshToken: newRawRefreshToken,
    };
  }

  async isSessionValid(sessionId: string): Promise<boolean> {
    const cached = await this.redisService.get(`session:${sessionId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return !parsed.isRevoked;
      } catch {
        // Fallback to DB check
      }
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.isRevoked || new Date() > session.expiresAt) {
      return false;
    }

    await this.redisService.set(
      `session:${session.id}`,
      JSON.stringify({ userId: session.userId, isRevoked: false }),
      3600,
    );

    return true;
  }

  async revokeSession(sessionId: string, reason = 'LOGOUT'): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    await this.redisService.del(`session:${sessionId}`);
  }

  async revokeSessionFamily(familyId: string, reason = 'FAMILY_REVOKED'): Promise<void> {
    const sessions = await this.prisma.authSession.findMany({
      where: { familyId },
      select: { id: true },
    });

    await this.prisma.authSession.updateMany({
      where: { familyId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    for (const s of sessions) {
      await this.redisService.del(`session:${s.id}`);
    }
  }

  async revokeAllUserSessions(userId: string, reason = 'LOGOUT_ALL'): Promise<void> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, isRevoked: false },
      select: { id: true },
    });

    await this.prisma.authSession.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    for (const s of sessions) {
      await this.redisService.del(`session:${s.id}`);
    }
  }
}
