import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityAction,
  Prisma,
  Role,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TaskQueryDto } from './dto/taskQuery.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { ActivityService } from '../activity/activity.service';
import { NotificationService } from '../notification/notification.service';
import { ProjectService } from '../project/project.service';
import { CreateTaskDto } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTask(
    userId: string,
    userRole: Role,
    actorName: string,
    projectId: string,
    dto: CreateTaskDto,
  ) {
    // 1. Verify project exists and actor has access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }
    await this.projectService.checkProjectAccess(userId, userRole, projectId);

    // 2. Validate assignee access if provided
    let assigneeName = '';
    if (dto.assigneeId) {
      const assigneeUser = await this.prisma.user.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!assigneeUser) {
        throw new NotFoundException({
          message: 'Assignee not found',
          code: 'ASSIGNEE_NOT_FOUND',
        });
      }
      assigneeName = assigneeUser.name;
      await this.projectService.checkProjectAccess(
        dto.assigneeId,
        assigneeUser.role,
        projectId,
      );
    }

    // 3. Create the task
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status || TaskStatus.TODO,
        priority: dto.priority || TaskPriority.MEDIUM,
        dueDate,
        projectId,
        assigneeId: dto.assigneeId,
        creatorId: userId,
      },
    });

    // 4. Log actions
    await this.activityService.logActivity(
      userId,
      projectId,
      ActivityAction.TASK_CREATED,
      task.id,
      'Task',
      { taskTitle: task.title, priority: task.priority },
    );

    if (dto.assigneeId) {
      await this.activityService.logActivity(
        userId,
        projectId,
        ActivityAction.TASK_ASSIGNED,
        task.id,
        'Task',
        { taskTitle: task.title, assigneeId: dto.assigneeId, assigneeName },
      );

      // Queue assignment notification
      await this.notificationService.queueNotification(
        dto.assigneeId,
        'Task Assigned',
        `You have been assigned to task '${task.title}' in project '${project.name}' by ${actorName}.`,
        `/projects/${projectId}`, // We don't have task-specific page yet so project page is fine
      );
    }

    return task;
  }

  async getTasks(
    userId: string,
    userRole: Role,
    projectId: string,
    query: TaskQueryDto,
  ) {
    // 1. Verify project exists and user has access
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }
    await this.projectService.checkProjectAccess(userId, userRole, projectId);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    // 2. Build filters
    const where: Prisma.TaskWhereInput = {
      projectId,
    };

    if (query.status) {
      where.status = query.status.toUpperCase() as TaskStatus;
    }

    if (query.priority) {
      where.priority = query.priority.toUpperCase() as TaskPriority;
    }

    if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }

    if (query.searchTerm) {
      where.OR = [
        { title: { contains: query.searchTerm, mode: 'insensitive' } },
        { description: { contains: query.searchTerm, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
      }),
      this.prisma.task.count({ where }),
    ]);

    return PaginationUtil.createResult(data, total, page, limit);
  }

  async getTaskById(userId: string, userRole: Role, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException({
        message: 'Task not found',
        code: 'TASK_NOT_FOUND',
      });
    }

    // Check project access
    await this.projectService.checkProjectAccess(
      userId,
      userRole,
      task.projectId,
    );

    return task;
  }

  async updateTask(
    userId: string,
    userRole: Role,
    actorName: string,
    id: string,
    dto: UpdateTaskDto,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            name: true,
          },
        },
      },
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

    // Validate assignee if being changed
    let newAssigneeUser = null;
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      if (dto.assigneeId !== null) {
        const assignee = await this.prisma.user.findUnique({
          where: { id: dto.assigneeId },
        });
        if (!assignee) {
          throw new NotFoundException({
            message: 'New assignee not found',
            code: 'ASSIGNEE_NOT_FOUND',
          });
        }
        await this.projectService.checkProjectAccess(
          dto.assigneeId,
          assignee.role,
          task.projectId,
        );
        newAssigneeUser = assignee;
      }
    }

    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : dto.dueDate === null
        ? null
        : undefined;

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate,
        assigneeId: dto.assigneeId,
      },
    });

    // Logging & Notifications
    const actionsLogged: string[] = [];

    // Status Changed check
    if (dto.status && dto.status !== task.status) {
      await this.activityService.logActivity(
        userId,
        task.projectId,
        ActivityAction.TASK_STATUS_CHANGED,
        id,
        'Task',
        {
          taskTitle: task.title,
          oldStatus: task.status,
          newStatus: dto.status,
        },
      );
      actionsLogged.push('status');

      // Notify creator & assignee
      const recipients = new Set<string>();
      if (task.creatorId !== userId) recipients.add(task.creatorId);
      if (task.assigneeId && task.assigneeId !== userId)
        recipients.add(task.assigneeId);

      for (const recipientId of recipients) {
        await this.notificationService.queueNotification(
          recipientId,
          'Task Status Updated',
          `Task '${task.title}' status was changed to '${dto.status}' by ${actorName}.`,
          `/projects/${task.projectId}`,
        );
      }
    }

    // Assignment Changed check
    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      await this.activityService.logActivity(
        userId,
        task.projectId,
        ActivityAction.TASK_ASSIGNED,
        id,
        'Task',
        {
          taskTitle: task.title,
          assigneeId: dto.assigneeId,
          assigneeName: newAssigneeUser ? newAssigneeUser.name : 'Unassigned',
        },
      );
      actionsLogged.push('assignee');

      if (dto.assigneeId && dto.assigneeId !== userId) {
        await this.notificationService.queueNotification(
          dto.assigneeId,
          'Task Assigned',
          `You have been assigned to task '${task.title}' in project '${task.project.name}' by ${actorName}.`,
          `/projects/${task.projectId}`,
        );
      }
    }

    // Generic Update Log if any other field changed and status/assignee were not the only ones
    const keys = Object.keys(dto).filter(
      (k) => dto[k as keyof UpdateTaskDto] !== undefined,
    );
    const hasOtherChanges = keys.some(
      (k) => k !== 'status' && k !== 'assigneeId',
    );

    if (hasOtherChanges) {
      await this.activityService.logActivity(
        userId,
        task.projectId,
        ActivityAction.TASK_UPDATED,
        id,
        'Task',
        {
          updatedFields: keys.filter(
            (k) => k !== 'status' && k !== 'assigneeId',
          ),
        },
      );
    }

    return updated;
  }

  async deleteTask(userId: string, userRole: Role, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
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

    await this.prisma.task.delete({
      where: { id },
    });

    await this.activityService.logActivity(
      userId,
      task.projectId,
      ActivityAction.TASK_DELETED,
      id,
      'Task',
      { taskTitle: task.title },
    );

    return { success: true };
  }
}
