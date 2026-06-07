import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { ResponseMessage } from '../../common/decorators/responseMessage.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { UpdateUserRoleDto } from './dto/updateRole.dto';
import { UpdateUserStatusDto } from './dto/updateStatus.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Users retrieved successfully')
  async getUsers(@Query() query: QueryDto) {
    return this.userService.getUsers(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User profile retrieved successfully')
  async getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('avatar', {
      fileFilter: (req: any, file: any, cb: any) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException({
              message: 'Only image files (jpg, jpeg, png, gif) are allowed',
              code: 'INVALID_FILE_TYPE',
            }),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  @ResponseMessage('User profile updated successfully')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // Only allow updating own profile, unless the current user is an Admin
    if (currentUser.id !== id && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException({
        message: 'You are not authorized to update this profile',
        code: 'FORBIDDEN',
      });
    }

    return this.userService.updateUser(id, dto, file);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User role updated successfully')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.userService.updateUserRole(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User status updated successfully')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.userService.updateUserStatus(id, dto);
  }
}
