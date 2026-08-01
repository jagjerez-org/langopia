import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";

const CEFR_LEVELS = Object.values(CefrLevel) as readonly CefrLevel[];
/** Fecha sin hora: `periodStart`/`periodEnd` son columnas `date`, no `timestamptz`. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * DTO de entrada: valida la FORMA, no las reglas de negocio. Que ese
 * profesor haya dado clase a ese alumno en ese periodo, o que los periodos no
 * se solapen, lo decide el dominio — duplicarlo aquí garantizaría que un día
 * dejen de coincidir.
 */
export class EvaluateStudentDto {
  @IsUUID()
  teacherId!: string;

  @IsUUID()
  studentId!: string;

  @Matches(DATE_ONLY, { message: "periodStart debe tener formato AAAA-MM-DD" })
  periodStart!: string;

  @Matches(DATE_ONLY, { message: "periodEnd debe tener formato AAAA-MM-DD" })
  periodEnd!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  progressRating!: number;

  @IsOptional()
  @IsIn(CEFR_LEVELS)
  levelAtEvaluation?: CefrLevel | null;

  @IsOptional()
  @IsString()
  @MinLength(3)
  strengths?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3)
  improvements?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(3)
  nextSteps?: string | null;
}

export class StudentsWithoutEvaluationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weeks?: number;
}

/**
 * DTO de entrada de `submit-attempt`: valida la FORMA, no las reglas de
 * negocio. El tope de reintentos y la respuesta vacía los decide
 * `Attempt.submit()` — duplicarlo aquí garantizaría que un día dejen de
 * coincidir. `response` es intencionadamente `Record<string, unknown>`: su
 * forma depende del tipo de ejercicio (tarea 2 de `learning`), y este DTO no
 * la conoce.
 */
export class SubmitAttemptDto {
  @IsUUID()
  exerciseId!: string;

  @IsUUID()
  studentProfileId!: string;

  @IsNotEmptyObject()
  response!: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  sessionId?: string | null;

  @IsOptional()
  @IsUUID()
  assessmentId?: string | null;

  @IsOptional()
  @IsISO8601()
  startedAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  durationMs?: number | null;
}

export class ValidateAttemptDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  teacherScore!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  teacherFeedback?: string | null;
}

export class ReturnAttemptDto {
  @IsString()
  @MinLength(1)
  teacherFeedback!: string;
}

/**
 * DTO de entrada de `start-placement-test` (Tarea 8 de la ola 2): valida la
 * FORMA. `language` es el idioma que se enseña (`courses.language`), texto
 * libre igual que en el resto del esquema — no un `IsIn` cerrado.
 */
export class StartPlacementTestDto {
  @IsUUID()
  studentProfileId!: string;

  @IsString()
  @MinLength(2)
  language!: string;
}

/**
 * DTO de entrada de `answer-placement-test`. `snapshot` es intencionadamente
 * `Record<string, unknown>`: es el estado opaco que devolvió `start` (o la
 * respuesta anterior), y su forma la valida `PlacementTest.rehydrate()`, no
 * este DTO — igual que `SubmitAttemptDto.response` no conoce la forma de
 * cada tipo de ejercicio.
 */
export class AnswerPlacementTestDto {
  @IsUUID()
  itemId!: string;

  @IsNotEmptyObject()
  response!: Record<string, unknown>;

  @IsObject()
  @IsNotEmptyObject()
  snapshot!: Record<string, unknown>;
}

/* ─── Exámenes (Tarea 15 de la ola 2) ────────────────────────────────────── */

const EXAM_KINDS = ["unit_exam", "level_exam", "mock_official"] as const;

/**
 * DTO de entrada de `generate-exam`: valida la FORMA. Que las unidades estén
 * publicadas, que el reparto sume 100 o que un `mock_official` traiga
 * `mockFramework` lo decide `Exam.generate()` — duplicarlo aquí garantizaría
 * que un día dejen de coincidir.
 */
export class GenerateExamDto {
  @IsIn(EXAM_KINDS)
  kind!: (typeof EXAM_KINDS)[number];

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(4, { each: true })
  studentProfileIds!: string[];

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(2)
  language!: string;

  @IsIn(CEFR_LEVELS)
  level!: CefrLevel;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(4, { each: true })
  sourceContentUnitIds!: string[];

  @IsOptional()
  @IsObject()
  skillDistribution?: Record<string, number>;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  mockFramework?: string | null;

  @IsOptional()
  @IsISO8601()
  scheduledFor?: string | null;
}

/**
 * `responses` es intencionadamente `Record<string, Record<string, unknown>>`:
 * la respuesta de cada ítem, indexada por su `id` — su forma depende del
 * tipo del ítem, y este DTO no la conoce (igual que `SubmitAttemptDto.response`).
 */
export class SubmitExamDto {
  @IsNotEmptyObject()
  responses!: Record<string, Record<string, unknown>>;
}

export class ValidateExamDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;
}
