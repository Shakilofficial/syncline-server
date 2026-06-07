import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;
  private logger = new Logger('Database');

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });

    this.pool = pool;

    // Mask password in logs
    let maskedUrl = connectionString;
    try {
      const parsed = new URL(connectionString);
      if (parsed.password) {
        parsed.password = '••••••••';
      }
      maskedUrl = parsed.toString();
    } catch {
      maskedUrl = connectionString.replace(/:([^:@]+)@/, ':••••••••@');
    }

    this.logger.log(`📡 Connecting to PostgreSQL: ${maskedUrl}`);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ PostgreSQL connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('⚠️ Database connection closed');
    await this.pool.end();
  }
}
