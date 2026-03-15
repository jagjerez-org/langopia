import { IsString, MaxLength } from "class-validator";

export class CompleteStepDto {
  @IsString()
  @MaxLength(50)
  step!: string;
}
