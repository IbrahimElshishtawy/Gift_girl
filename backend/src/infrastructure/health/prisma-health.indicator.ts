import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const healthy = await this.prismaService.isHealthy();
    const result = this.getStatus(key, healthy, {
      message: healthy ? 'PostgreSQL database query succeeded' : 'PostgreSQL query failed',
    });

    if (healthy) {
      return result;
    }
    throw new HealthCheckError('Database health check failed', result);
  }
}
