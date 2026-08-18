import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  organisationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,9}$/, {
    message: 'Key must be 1-10 uppercase letters, numbers, or hyphens (e.g. "WEB").',
  })
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
