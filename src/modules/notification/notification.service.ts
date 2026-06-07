import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { QueryDto } from '../../common/dto/query.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications-queue') private notificationQueue: Queue,
  ) {}

  // ── Dispatch Notification to Background Queue ─────────────────────────────────
  async queueNotification(
    userId: string,
    title: string,
    message: string,
    link?: string,
  ) {
    await this.notificationQueue.add('send-notification', {
      userId,
      title,
      message,
      link,
    });
  }

  // ── Retrieve User Notifications (Paginated) ──────────────────────────────────
  async getNotifications(userId: string, query: QueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const where: Prisma.NotificationWhereInput = { userId };

    if (query.status) {
      where.isRead = query.status === 'read';
    }

    if (query.searchTerm) {
      where.OR = [
        { title: { contains: query.searchTerm, mode: 'insensitive' } },
        { message: { contains: query.searchTerm, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return PaginationUtil.createResult(data, total, page, limit);
  }

  // ── Mark single notification as read ─────────────────────────────────────────
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException({
        message: 'Notification not found',
        code: 'NOT_FOUND',
      });
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  // ── Mark all notifications as read ──────────────────────────────────────────
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, message: 'All notifications marked as read' };
  }

  // ── Delete single notification ───────────────────────────────────────────────
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException({
        message: 'Notification not found',
        code: 'NOT_FOUND',
      });
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true, message: 'Notification deleted successfully' };
  }
}
