import { IsNotEmpty, IsString } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'User ID is required' })
  userId!: string;
}
