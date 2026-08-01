import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";
import { CefrLevel } from "../../../../shared/domain/model/cefr-level.js";
import { EXERCISE_TYPES } from "../../../domain/model/exercise-schemas.js";

const CEFR_LEVELS = Object.values(CefrLevel);

/**
 * `POST /learning/units/from-material` (tarea 14 de la ola 2): los mismos
 * campos que `GenerateUnitDto` —la generación es la misma, con el material
 * propio como fuente— más el material del que sale. `source` NO viaja en el
 * cuerpo: una unidad creada por esta ruta es `hybrid` por definición, no por
 * lo que diga el cliente.
 */
export class CreateUnitFromMaterialDto {
  @IsUUID()
  materialId!: string;

  @IsString()
  @MinLength(3)
  code!: string;

  @IsString()
  @MinLength(2)
  language!: string;

  @IsIn(CEFR_LEVELS)
  level!: string;

  @IsString()
  @MinLength(3)
  topic!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  skills!: string[];

  @IsString()
  @MinLength(2)
  primaryLocale!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(EXERCISE_TYPES, { each: true })
  exerciseTypes!: string[];
}
