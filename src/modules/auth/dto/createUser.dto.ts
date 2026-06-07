import { Role } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  name!: string;

  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @Length(8, 72, { message: 'Password must be between 8 and 72 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password!: string;

  @IsOptional()
  @IsEnum(Role, {
    message: 'role must be one of ADMIN, PROJECT_MANAGER, TEAM_MEMBER',
  })
  role?: Role;
}
