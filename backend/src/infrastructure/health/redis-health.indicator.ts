import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const healthy = await this.redisService.isHealthy();
    const result = this.getStatus(key, healthy, {
      message: healthy ? 'Redis is responsive' : 'Redis ping failed',
    });

    if (healthy) {
      return result;
    }
    throw new HealthCheckError('Redis health check failed', result);
  }
}
