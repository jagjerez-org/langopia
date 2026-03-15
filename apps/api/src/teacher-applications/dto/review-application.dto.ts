import { IsString, IsOptional, IsIn } from "class-validator";

export class ReviewApplicationDto {
  @IsString()
  @IsIn(["approved", "rejected"])
  status!: string;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
