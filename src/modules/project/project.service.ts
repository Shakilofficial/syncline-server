import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma, ProjectStatus, Role } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { QueryDto } from '../../common/dto/query.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { ActivityService } from '../activity/activity.service';
import { NotificationService } from '../notification/notification.service';
import { CreateProjectDto } from './dto/createProject.dto';
import { UpdateProjectDto } from './dto/updateProject.dto';
import { AddMemberDto } from './dto/addMember.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
  ) {}

  async checkProjectAccess(userId: string, userRole: Role, projectId: string) {
    if (userRole === Role.ADMIN || userRole === Role.PROJECT_MANAGER) {
      return;
    }
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    if (!member) {
      throw new ForbiddenException({
        message: 'You do not have access to this project',
        code: 'PROJECT_ACCESS_DENIED',
      });
    }
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    const deadline = dto.deadline ? new Date(dto.deadline) : undefined;

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        deadline,
        status: dto.status,
        members: {
          create: {
            userId,
          },
        },
      },
    });

    await this.activityService.logActivity(
      userId,
      project.id,
      ActivityAction.PROJECT_CREATED,
      project.id,
      'Project',
      { projectName: project.name },
    );

    return project;
  }

  async getProjects(userId: string, userRole: Role, query: QueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const where: Prisma.ProjectWhereInput = {};

    if (userRole === Role.TEAM_MEMBER) {
      where.members = {
        some: { userId },
      };
    }

    if (query.searchTerm) {
      where.name = {
        contains: query.searchTerm,
        mode: 'insensitive',
      };
    }

    if (query.status) {
      where.status = query.status.toUpperCase() as ProjectStatus;
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          _count: {
            select: {
              members: true,
              tasks: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take,
      }),
      this.prisma.project.count({ where }),
    ]);

    return PaginationUtil.createResult(data, total, page, limit);
  }

  async getProjectById(userId: string, userRole: Role, id: string) {
    await this.checkProjectAccess(userId, userRole, id);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }

    return project;
  }

  async updateProject(userId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }

    const deadline = dto.deadline
      ? new Date(dto.deadline)
      : dto.deadline === null
        ? null
        : undefined;

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        deadline,
        status: dto.status,
      },
    });

    const updatedFields = Object.keys(dto).filter(
      (key) => dto[key as keyof UpdateProjectDto] !== undefined,
    );

    await this.activityService.logActivity(
      userId,
      id,
      ActivityAction.PROJECT_UPDATED,
      id,
      'Project',
      { updatedFields },
    );

    return updated;
  }

  async deleteProject(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }

    await this.prisma.project.delete({
      where: { id },
    });

    await this.activityService.logActivity(
      userId,
      null,
      ActivityAction.PROJECT_DELETED,
      id,
      'Project',
      { projectName: project.name },
    );

    return { success: true };
  }

  async addMember(
    actorId: string,
    actorName: string,
    projectId: string,
    dto: AddMemberDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }

    const userToAdd = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!userToAdd) {
      throw new NotFoundException({
        message: 'User to add not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: dto.userId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException({
        message: 'User is already a member of this project',
        code: 'MEMBER_ALREADY_EXISTS',
      });
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
      },
      include: {
        user: {
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
      actorId,
      projectId,
      ActivityAction.MEMBER_ADDED,
      member.id,
      'ProjectMember',
      { addedUserId: dto.userId, addedUserEmail: userToAdd.email },
    );

    await this.notificationService.queueNotification(
      dto.userId,
      'Project Invitation',
      `You have been added to the project '${project.name}' by ${actorName}.`,
      `/projects/${projectId}`,
    );

    return member;
  }

  async removeMember(
    actorId: string,
    actorName: string,
    projectId: string,
    userIdToRemove: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException({
        message: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
      });
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: userIdToRemove,
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        message: 'Project member not found',
        code: 'MEMBER_NOT_FOUND',
      });
    }

    await this.prisma.projectMember.delete({
      where: {
        id: member.id,
      },
    });

    await this.activityService.logActivity(
      actorId,
      projectId,
      ActivityAction.MEMBER_REMOVED,
      member.id,
      'ProjectMember',
      { removedUserId: userIdToRemove },
    );

    await this.notificationService.queueNotification(
      userIdToRemove,
      'Project Removal',
      `You have been removed from the project '${project.name}' by ${actorName}.`,
    );

    return { success: true };
  }

  async getActivityLogs(
    userId: string,
    userRole: Role,
    projectId: string,
    query: QueryDto,
  ) {
    await this.checkProjectAccess(userId, userRole, projectId);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const { skip, take } = PaginationUtil.getSkipTake(page, limit);

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { projectId },
        include: {
          user: {
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
        skip,
        take,
      }),
      this.prisma.activityLog.count({
        where: { projectId },
      }),
    ]);

    return PaginationUtil.createResult(data, total, page, limit);
  }
}
