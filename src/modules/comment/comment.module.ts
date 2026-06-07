import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { ProjectModule } from '../project/project.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ProjectModule, ActivityModule, NotificationModule],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
