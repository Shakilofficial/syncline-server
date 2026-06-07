import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';
import { StorageModule } from '../../core/storage/storage.module';
import { ProjectModule } from '../project/project.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [StorageModule, ProjectModule, ActivityModule, NotificationModule],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
