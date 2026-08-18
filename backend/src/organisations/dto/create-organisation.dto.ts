import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrganisationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
