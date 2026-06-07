import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private logger = new Logger('Redis');

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl: string =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    let maskedUrl = redisUrl;
    try {
      const parsed = new URL(redisUrl);
      if (parsed.password) {
        parsed.password = '••••••••';
      }
      maskedUrl = parsed.toString();
    } catch {
      maskedUrl = redisUrl.replace(/:([^:@]+)@/, ':••••••••@');
    }

    this.logger.log(`📡 Connecting to Redis: ${maskedUrl}`);

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connection established');
    });

    this.client.on('ready', () => {
      this.logger.log('⚡ Redis is ready to accept commands');
    });

    this.client.on('error', (err) => {
      this.logger.error('❌ Redis connection error:', err);
    });

    this.client.on('close', () => {
      this.logger.warn('⚠️ Redis connection closed');
    });

    // Initiate connect async
    this.client.connect().catch((err) => {
      this.logger.error(
        '❌ Failed to connect to Redis on startup:',
        err.message,
      );
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
