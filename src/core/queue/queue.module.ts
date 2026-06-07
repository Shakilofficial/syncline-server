import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        return {
          connection: {
            url: redisUrl,
          },
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: 1000,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
