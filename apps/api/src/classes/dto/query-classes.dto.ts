import { IsOptional, IsString, IsDateString, IsInt, Min, Max, IsIn } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class QueryClassesDto {
  @ApiPropertyOptional({ enum: ["scheduled", "confirmed", "in_progress", "completed", "cancelled"] })
  @IsOptional()
  @IsIn(["scheduled", "confirmed", "in_progress", "completed", "cancelled"])
  status?: string;

  @ApiPropertyOptional({ description: "Filter classes from this date" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: "Filter classes to this date" })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: "Filter by teacher AcademyMember ID" })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ enum: ["individual", "group"] })
  @IsOptional()
  @IsIn(["individual", "group"])
  classType?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
