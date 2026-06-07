import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [ActivityModule, NotificationModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
