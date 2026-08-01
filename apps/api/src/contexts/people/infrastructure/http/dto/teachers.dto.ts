import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { TeacherTier } from "../../../domain/model/hourly-rate.vo.js";

const TEACHER_TIERS = Object.values(TeacherTier);

/**
 * DTO de entrada: valida la FORMA, no las reglas de negocio. Que la tarifa
 * caiga dentro del tramo declarado lo decide el dominio (`HourlyRate.of`),
 * no este fichero: el rango depende del tramo, y duplicarlo aquí garantizaría
 * que un día dejaran de coincidir.
 */
export class HireTeacherDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  email!: string;

  @IsIn(TEACHER_TIERS)
  tier!: TeacherTier;

  @IsInt()
  @Min(1)
  hourlyRateCents!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  contractedHoursPerWeek!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "hiredAt debe tener formato AAAA-MM-DD" })
  hiredAt!: string;

  @IsOptional()
  @IsString()
  locale?: string | null;
}

class AvailabilitySlotDto {
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @IsInt()
  @Min(0)
  startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute!: number;
}

export class SetAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[];
}

export class ReleaseTeacherDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

/**
 * `PATCH /teachers/:id`: semántica de parche. `tier`/`hourlyRateCents`
 * ausentes conservan el valor actual; que la combinación resultante sea
 * válida en el tramo lo decide `Teacher.changeHourlyRate`, no este DTO.
 */
export class UpdateTeacherDto {
  @IsOptional()
  @IsIn(TEACHER_TIERS)
  tier?: TeacherTier;

  @IsOptional()
  @IsInt()
  @Min(1)
  hourlyRateCents?: number;
}
