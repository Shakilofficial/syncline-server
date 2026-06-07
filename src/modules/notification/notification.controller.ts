import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryDto,
  ) {
    return this.notificationService.getNotifications(user.id, query);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationService.deleteNotification(user.id, id);
  }
}
