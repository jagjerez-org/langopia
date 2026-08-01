import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";
import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { ContentStatus } from "../../../domain/model/content-unit.aggregate.js";
import { EXERCISE_TYPES } from "../../../domain/model/exercise-schemas.js";

const CEFR_LEVELS = Object.values(CefrLevel);
const CONTENT_STATUSES = Object.values(ContentStatus);

/**
 * DTO de entrada: la frontera del sistema.
 *
 * Valida la FORMA, no las reglas de negocio: que la escuela tenga créditos,
 * que exista la rúbrica o que el tipo de ejercicio admita audio lo decide el
 * dominio (`CreditLedgerPort`, `Exercise.create()`), no este DTO.
 */
export class GenerateUnitDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  language!: string;

  @IsIn(CEFR_LEVELS)
  level!: string;

  @IsString()
  @MinLength(1)
  topic!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  skills!: string[];

  @IsString()
  @MinLength(1)
  primaryLocale!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(EXERCISE_TYPES, { each: true })
  exerciseTypes!: string[];

  @IsOptional()
  @IsString()
  sourceMaterial?: string;
}

/** `GET /learning/units` (Tarea 11 del panel, Paso 3): filtro opcional por estado. */
export class ListUnitsQueryDto {
  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: string;
}

/**
 * `PATCH /learning/units/:unitId/exercises/:exerciseId` (Tarea 11 del panel,
 * Paso 3): edita el enunciado y, si el tipo lo lleva, la clave de respuesta.
 * Valida la FORMA (que sean objetos); que el CONTENIDO cumpla el esquema del
 * tipo lo decide `validateExercise()` en el manejador, igual que al generar.
 */
export class UpdateExerciseDto {
  @IsObject()
  prompt!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  solution?: Record<string, unknown>;
}

/**
 * `POST /learning/units/:id/publish` (Tarea 11 del panel, Paso 4): a qué
 * grupos llega la unidad. Opcional — publicar sin grupos deja la unidad
 * publicada sin repartir todavía—, y QUÉ grupos valen lo decide
 * `PublishUnitHandler` (mismo curso, nivel de la unidad), nunca este DTO.
 */
export class PublishUnitDto {
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  groupIds?: string[];
}
