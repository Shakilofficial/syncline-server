import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Role } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationService } from '../notification/notification.service';
import { ProjectService } from '../project/project.service';
import { CreateCommentDto } from './dto/createComment.dto';

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
  ) {}

  async createComment(
    userId: string,
    userRole: Role,
    commenterName: string,
    taskId: string,
    dto: CreateCommentDto,
  ) {
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

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        taskId,
        authorId: userId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    await this.activityService.logActivity(
      userId,
      task.projectId,
      ActivityAction.COMMENT_ADDED,
      comment.id,
      'Comment',
      {
        taskId,
        taskTitle: task.title,
        snippet: dto.content.slice(0, 50),
      },
    );

    // Queue notifications to creator & assignee (excluding the commenter)
    const recipients = new Set<string>();
    if (task.creatorId !== userId) recipients.add(task.creatorId);
    if (task.assigneeId && task.assigneeId !== userId)
      recipients.add(task.assigneeId);

    const snippet =
      dto.content.length > 50 ? `${dto.content.slice(0, 50)}...` : dto.content;

    for (const recipientId of recipients) {
      await this.notificationService.queueNotification(
        recipientId,
        'New Comment on Task',
        `${commenterName} commented on task '${task.title}': '${snippet}'`,
        `/projects/${task.projectId}`,
      );
    }

    return comment;
  }

  async getComments(userId: string, userRole: Role, taskId: string) {
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

    return this.prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async deleteComment(userId: string, userRole: Role, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          select: {
            projectId: true,
            title: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException({
        message: 'Comment not found',
        code: 'COMMENT_NOT_FOUND',
      });
    }

    // Check project access first
    await this.projectService.checkProjectAccess(
      userId,
      userRole,
      comment.task.projectId,
    );

    // Only allow deletion if author or Admin/Project Manager
    if (
      comment.authorId !== userId &&
      userRole !== Role.ADMIN &&
      userRole !== Role.PROJECT_MANAGER
    ) {
      throw new ForbiddenException({
        message: 'You are not authorized to delete this comment',
        code: 'FORBIDDEN',
      });
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    await this.activityService.logActivity(
      userId,
      comment.task.projectId,
      ActivityAction.COMMENT_DELETED,
      commentId,
      'Comment',
      {
        taskId: comment.taskId,
        taskTitle: comment.task.title,
      },
    );

    return { success: true };
  }
}
