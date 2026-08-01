import { IsString, MinLength } from "class-validator";

export class AddSiteDomainDto {
  @IsString()
  @MinLength(3)
  hostname!: string;
}
