import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import redisConfig from '../../config/redis.config';
import { IRedisService } from './redis.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements IRedisService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly options: RedisOptions;

  constructor(
    @Inject(redisConfig.KEY)
    private readonly config: ConfigType<typeof redisConfig>,
  ) {
    this.options = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      lazyConnect: true,
      maxRetriesPerRequest: null, // Required for BullMQ compatibility
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 3000);
        this.logger.warn(`Redis reconnecting attempt #${times} in ${delay}ms...`);
        return delay;
      },
    };
    this.client = new Redis(this.options);

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected successfully.');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.log('Redis initialized and ready.');
    } catch (error) {
      this.logger.error('Failed to initialize Redis connection:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Redis client...');
    await this.client.quit();
    this.logger.log('Redis client disconnected.');
  }

  getClientOptions(): RedisOptions {
    return { ...this.options };
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (ttlSeconds && ttlSeconds > 0) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const lockValue = randomUUID();
    const result = await this.client.set(`lock:${key}`, lockValue, 'PX', ttlMs, 'NX');
    return result === 'OK' ? lockValue : null;
  }

  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(`lock:${key}`, 1, lockValue, script);
    return result === 1;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }
}
