import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @Length(2, 150, { message: 'Title must be between 2 and 150 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus, { message: 'Invalid status' })
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority, { message: 'Invalid priority' })
  @IsOptional()
  priority?: TaskPriority;

  @IsDateString({}, { message: 'Due date must be a valid date' })
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;
}
