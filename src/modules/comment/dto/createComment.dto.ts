import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Comment content is required' })
  @Length(1, 1000, { message: 'Comment must be between 1 and 1000 characters' })
  content!: string;
}
