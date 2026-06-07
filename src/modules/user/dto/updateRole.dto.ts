import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(Role, {
    message: 'role must be one of ADMIN, PROJECT_MANAGER, TEAM_MEMBER',
  })
  role!: Role;
}
