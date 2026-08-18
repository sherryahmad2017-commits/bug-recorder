import { IsUUID } from 'class-validator';

export class ListProjectsQuery {
  @IsUUID()
  organisationId!: string;
}
