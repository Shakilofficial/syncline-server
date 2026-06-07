import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ResponseMessage } from '../../common/decorators/responseMessage.decorator';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { AttachmentService } from './attachment.service';

@Controller()
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post('tasks/:taskId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (!file) {
          cb(
            new BadRequestException({
              message: 'No file provided',
              code: 'FILE_MISSING',
            }),
            false,
          );
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
      },
    }),
  )
  @ResponseMessage('Attachment uploaded successfully')
  async uploadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attachmentService.uploadAttachment(
      user.id,
      user.role,
      user.name,
      taskId,
      file,
    );
  }

  @Get('tasks/:taskId/attachments')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attachments retrieved successfully')
  async getAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.attachmentService.getAttachments(user.id, user.role, taskId);
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Attachment deleted successfully')
  async deleteAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.attachmentService.deleteAttachment(user.id, user.role, id);
  }
}
