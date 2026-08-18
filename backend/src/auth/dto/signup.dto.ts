import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Mirrors the complexity policy stated in docs/ARCHITECTURE.md §20.
  @IsString()
  @MinLength(10, { message: 'Password must be at least 10 characters.' })
  @MaxLength(128)
  @Matches(/[a-z]/, { message: 'Password must include a lowercase letter.' })
  @Matches(/[A-Z]/, { message: 'Password must include an uppercase letter.' })
  @Matches(/[0-9]/, { message: 'Password must include a number.' })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  organisationName!: string;
}
