import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityEventType, Prisma } from '@prisma/client';

@Injectable()
export class SecurityAuditService {
  private readonly logger = new Logger(SecurityAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(
    event: SecurityEventType,
    userId?: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.securityAuditEvent.create({
        data: {
          event,
          userId: userId || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      this.logger.debug(
        `Security audit event recorded: [${event}] ${userId ? `User: ${userId}` : `IP: ${ipAddress}`}`,
      );
    } catch (error) {
      this.logger.error(`Failed to record security audit event [${event}]:`, error);
      // Non-blocking: Audit failure should not crash primary auth transaction
    }
  }
}
