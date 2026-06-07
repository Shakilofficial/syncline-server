import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ResponseMessage } from '../../common/decorators/responseMessage.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/createProject.dto';
import { UpdateProjectDto } from './dto/updateProject.dto';
import { AddMemberDto } from './dto/addMember.dto';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Project created successfully')
  async createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.createProject(user.id, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Projects retrieved successfully')
  async getProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDto,
  ) {
    return this.projectService.getProjects(user.id, user.role, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Project details retrieved successfully')
  async getProjectById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectService.getProjectById(user.id, user.role, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Project updated successfully')
  async updateProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Project deleted successfully')
  async deleteProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.projectService.deleteProject(user.id, id);
  }

  @Post(':id/members')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Member added successfully')
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectService.addMember(user.id, user.name, id, dto);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Member removed successfully')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectService.removeMember(user.id, user.name, id, userId);
  }

  @Get(':id/activity-logs')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Project activity logs retrieved successfully')
  async getActivityLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: QueryDto,
  ) {
    return this.projectService.getActivityLogs(user.id, user.role, id, query);
  }
}
