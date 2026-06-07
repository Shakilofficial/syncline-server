import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { ProjectModule } from '../project/project.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ProjectModule, ActivityModule, NotificationModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
