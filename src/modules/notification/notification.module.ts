import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationProcessor } from '../../core/queue/processors/notification.processor';
import { AuthModule } from '../auth/auth.module';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications-queue',
    }),
    AuthModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationGateway, NotificationService, NotificationProcessor],
  exports: [NotificationService, NotificationGateway, BullModule],
})
export class NotificationModule {}
