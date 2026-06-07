import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @Length(8, 72, {
    message: 'New password must be between 8 and 72 characters',
  })
  @Matches(/[A-Z]/, {
    message: 'New password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'New password must contain at least one number',
  })
  newPassword!: string;
}
