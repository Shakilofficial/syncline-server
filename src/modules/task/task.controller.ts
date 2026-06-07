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
import { ResponseMessage } from '../../common/decorators/responseMessage.decorator';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';
import { TaskQueryDto } from './dto/taskQuery.dto';

@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post('projects/:projectId/tasks')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Task created successfully')
  async createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.createTask(
      user.id,
      user.role,
      user.name,
      projectId,
      dto,
    );
  }

  @Get('projects/:projectId/tasks')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tasks retrieved successfully')
  async getTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Query() query: TaskQueryDto,
  ) {
    return this.taskService.getTasks(user.id, user.role, projectId, query);
  }

  @Get('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Task details retrieved successfully')
  async getTaskById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.taskService.getTaskById(user.id, user.role, id);
  }

  @Patch('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Task updated successfully')
  async updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(user.id, user.role, user.name, id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Task deleted successfully')
  async deleteTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.taskService.deleteTask(user.id, user.role, id);
  }
}
