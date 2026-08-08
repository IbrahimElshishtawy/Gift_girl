import { RedisOptions } from 'ioredis';

export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  acquireLock(key: string, ttlMs: number): Promise<string | null>;
  releaseLock(key: string, lockValue: string): Promise<boolean>;
  isHealthy(): Promise<boolean>;
  getClientOptions(): RedisOptions;
}
