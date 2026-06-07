import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  name!: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @Length(8, 72, { message: 'Password must be between 8 and 72 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password!: string;
}
