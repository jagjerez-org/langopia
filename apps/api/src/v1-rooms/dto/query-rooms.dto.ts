import { IsOptional, IsInt, Min, Max, IsIn } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class QueryRoomsDto {
  @ApiPropertyOptional({ enum: ["waiting", "active", "completed", "cancelled"] })
  @IsOptional()
  @IsIn(["waiting", "active", "completed", "cancelled"])
  status?: string;

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
