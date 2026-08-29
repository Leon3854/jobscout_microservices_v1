import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  /**
   * Проверить соединение с Redis.
   * @returns true если Redis отвечает
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error(`Redis ping failed: ${error.message}`);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async lock(key: string, ttl: number = 30): Promise<boolean> {
    const result = await this.redis.set(
      `lock:${key}`,
      'locked',
      'EX',
      ttl,
      'NX',
    );
    return result === 'OK';
  }

  async unlock(key: string): Promise<void> {
    await this.redis.del(`lock:${key}`);
  }

  async increment(key: string, ttl: number): Promise<number> {
    const value = await this.redis.incr(key);
    if (value === 1) {
      await this.redis.expire(key, ttl);
    }
    return value;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) === 1;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
