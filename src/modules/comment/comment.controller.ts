import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ResponseMessage } from '../../common/decorators/responseMessage.decorator';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/createComment.dto';

@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('tasks/:taskId/comments')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Comment added successfully')
  async createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.createComment(
      user.id,
      user.role,
      user.name,
      taskId,
      dto,
    );
  }

  @Get('tasks/:taskId/comments')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Comments retrieved successfully')
  async getComments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.commentService.getComments(user.id, user.role, taskId);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Comment deleted successfully')
  async deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.commentService.deleteComment(user.id, user.role, id);
  }
}
