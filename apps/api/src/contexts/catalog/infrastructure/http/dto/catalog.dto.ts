import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { CourseModality } from "../../../domain/model/course-modality.js";

const CEFR_LEVELS = Object.values(CefrLevel);
const COURSE_MODALITIES = Object.values(CourseModality);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DTO de entrada: valida la FORMA, no las reglas de negocio. Que un curso
 * privado tenga capacidad 1, o que el precio acordado no sea negativo, lo
 * decide el dominio (`Course.create()`, `Group.enrol()`).
 */
class CourseTranslationDto {
  @IsString()
  @MinLength(2)
  locale!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(2)
  language!: string;

  @IsIn(CEFR_LEVELS)
  level!: string;

  @IsIn(COURSE_MODALITIES)
  modality!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSessions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  sessionMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStudents?: number;

  /** Precio de catálogo, en céntimos enteros. Nunca coma flotante. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CourseTranslationDto)
  translations!: CourseTranslationDto[];
}

export class CreateGroupDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @IsString()
  @MinLength(1)
  name!: string;

  @Matches(DATE_ONLY, { message: "startsOn debe tener formato AAAA-MM-DD" })
  startsOn!: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: "endsOn debe tener formato AAAA-MM-DD" })
  endsOn?: string | null;
}

export class EnrolStudentDto {
  @IsUUID()
  studentId!: string;

  /** Precio realmente acordado, en céntimos enteros. `null` = el de catálogo. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  agreedPriceCents?: number | null;
}
