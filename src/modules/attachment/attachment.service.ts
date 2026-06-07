import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Role } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { StorageService } from '../../core/storage/storage.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationService } from '../notification/notification.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class AttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly storageService: StorageService,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
  ) {}

  async uploadAttachment(
    userId: string,
    userRole: Role,
    uploaderName: string,
    taskId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        message: 'No file uploaded',
        code: 'FILE_MISSING',
      });
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException({
        message: 'Task not found',
        code: 'TASK_NOT_FOUND',
      });
    }

    await this.projectService.checkProjectAccess(
      userId,
      userRole,
      task.projectId,
    );

    // Upload to S3/R2
    const uploadResult = await this.storageService.uploadFile(
      file,
      'attachments',
    );

    // Create database record
    const attachment = await this.prisma.attachment.create({
      data: {
        filename: uploadResult.key,
        originalName: file.originalname,
        url: uploadResult.url,
        storageKey: uploadResult.key,
        mimeType: file.mimetype,
        size: file.size,
        taskId,
        uploadedBy: userId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    await this.activityService.logActivity(
      userId,
      task.projectId,
      ActivityAction.ATTACHMENT_ADDED,
      attachment.id,
      'Attachment',
      {
        taskId,
        filename: file.originalname,
        size: file.size,
      },
    );

    // Queue notifications to creator & assignee (excluding uploader)
    const recipients = new Set<string>();
    if (task.creatorId !== userId) recipients.add(task.creatorId);
    if (task.assigneeId && task.assigneeId !== userId)
      recipients.add(task.assigneeId);

    for (const recipientId of recipients) {
      await this.notificationService.queueNotification(
        recipientId,
        'New Attachment on Task',
        `${uploaderName} uploaded file '${file.originalname}' to task '${task.title}'.`,
        `/projects/${task.projectId}`,
      );
    }

    return attachment;
  }

  async getAttachments(userId: string, userRole: Role, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException({
        message: 'Task not found',
        code: 'TASK_NOT_FOUND',
      });
    }

    await this.projectService.checkProjectAccess(
      userId,
      userRole,
      task.projectId,
    );

    return this.prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async deleteAttachment(userId: string, userRole: Role, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          select: {
            projectId: true,
            title: true,
          },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException({
        message: 'Attachment not found',
        code: 'ATTACHMENT_NOT_FOUND',
      });
    }

    // Check project access first
    await this.projectService.checkProjectAccess(
      userId,
      userRole,
      attachment.task.projectId,
    );

    // Only allow deletion if uploader or Admin/Project Manager
    if (
      attachment.uploadedBy !== userId &&
      userRole !== Role.ADMIN &&
      userRole !== Role.PROJECT_MANAGER
    ) {
      throw new ForbiddenException({
        message: 'You are not authorized to delete this attachment',
        code: 'FORBIDDEN',
      });
    }

    // Delete from S3/R2
    try {
      await this.storageService.deleteFile(attachment.storageKey);
    } catch {
      // Log error but proceed to delete record from DB in case file is already gone
    }

    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    await this.activityService.logActivity(
      userId,
      attachment.task.projectId,
      ActivityAction.ATTACHMENT_DELETED,
      attachmentId,
      'Attachment',
      {
        taskId: attachment.taskId,
        filename: attachment.originalName,
      },
    );

    return { success: true };
  }
}
