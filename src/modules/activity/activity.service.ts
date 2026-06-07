import { Injectable } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(
    userId: string,
    projectId: string | null,
    action: ActivityAction,
    entityId?: string,
    entityType?: string,
    metadata?: Record<string, any>,
  ) {
    return this.prisma.activityLog.create({
      data: {
        userId,
        projectId,
        action,
        entityId,
        entityType,
        metadata: metadata
          ? (JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
