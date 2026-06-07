import { IsOptional, IsString } from 'class-validator';
import { QueryDto } from '../../../common/dto/query.dto';

export class TaskQueryDto extends QueryDto {
  @IsOptional()
  @IsString()
  assigneeId?: string;
}
