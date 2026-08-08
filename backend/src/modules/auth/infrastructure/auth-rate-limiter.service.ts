import { Injectable, Logger, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import authConfig from '../../../config/auth.config';

@Injectable()
export class AuthRateLimiterService {
  private readonly logger = new Logger(AuthRateLimiterService.name);

  constructor(
    private readonly redisService: RedisService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async checkRateLimit(
    endpointKey: string,
    identifierKey: string,
    customMaxAttempts?: number,
    customWindowSeconds?: number,
  ): Promise<void> {
    const max = customMaxAttempts || this.config.rateLimitLoginMax;
    const windowSeconds = customWindowSeconds || this.config.rateLimitWindowSeconds;

    const redisKey = `ratelimit:${endpointKey}:${identifierKey}`;
    const currentCount = await this.redisService.get(redisKey);

    if (currentCount && parseInt(currentCount, 10) >= max) {
      this.logger.warn(
        `Rate limit exceeded for endpoint [${endpointKey}] identifier [${identifierKey}]`,
      );
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!currentCount) {
      await this.redisService.set(redisKey, '1', windowSeconds);
    } else {
      const count = parseInt(currentCount, 10) + 1;
      await this.redisService.set(redisKey, count.toString(), windowSeconds);
    }
  }
}
