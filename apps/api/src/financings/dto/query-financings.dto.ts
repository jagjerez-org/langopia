import { IsOptional, IsString, IsIn } from "class-validator";

export class QueryFinancingsDto {
  @IsOptional()
  @IsString()
  @IsIn(["daily", "monthly", "quarterly", "annual"])
  period?: string;

  @IsOptional()
  @IsString()
  academyPlanId?: string;
}
