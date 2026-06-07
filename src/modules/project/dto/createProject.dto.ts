import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  @Length(2, 100, {
    message: 'Project name must be between 2 and 100 characters',
  })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString({}, { message: 'Deadline must be a valid date' })
  @IsOptional()
  deadline?: string;

  @IsEnum(ProjectStatus, { message: 'Invalid status' })
  @IsOptional()
  status?: ProjectStatus;
}
