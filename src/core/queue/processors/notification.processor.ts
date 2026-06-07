import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationGateway } from '../../../modules/notification/notification.gateway';
import { Logger } from '@nestjs/common';

@Processor('notifications-queue')
export class NotificationProcessor extends WorkerHost {
  private logger = new Logger('NotificationProcessor');

  constructor(
    private prisma: PrismaService,
    private gateway: NotificationGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-notification') {
      const { userId, title, message, link } = job.data;

      this.logger.log(
        `🔄 Processing background notification job for user: ${userId}`,
      );

      try {
        // 1. Persist notification in database
        const notification = await this.prisma.notification.create({
          data: {
            userId,
            title,
            message,
            link,
          },
        });

        // 2. Broadcast in real-time via Socket.io to user room
        this.gateway.sendToUser(userId, 'notification:new', notification);

        this.logger.log(
          `✅ Notification processed and dispatched to socket user:${userId}`,
        );
        return notification;
      } catch (err: any) {
        this.logger.error(`❌ Failed to process notification: ${err.message}`);
        throw err;
      }
    }
  }
}
