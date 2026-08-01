import { Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ConsentKind } from "../../../domain/model/consent.vo.js";

const GUARDIAN_RELATIONSHIPS = ["mother", "father", "legal_guardian", "other"] as const;
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const CONSENT_KINDS_LIST = Object.values(ConsentKind);

/**
 * DTO de entrada: valida la FORMA, no las reglas de negocio. Que un menor
 * necesite tutor lo decide el dominio (`EnrolStudentHandler`), no este
 * fichero: duplicarlo aquí garantizaría que un día dejaran de coincidir.
 */
class GuardianDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  email!: string;

  @IsIn(GUARDIAN_RELATIONSHIPS)
  relationship!: (typeof GUARDIAN_RELATIONSHIPS)[number];
}

export class EnrolStudentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  email!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateOfBirth debe tener formato AAAA-MM-DD" })
  dateOfBirth!: string;

  @IsString()
  nativeLanguage!: string;

  @IsString()
  targetLanguage!: string;

  @IsOptional()
  @IsString()
  locale?: string | null;

  @IsOptional()
  @IsIn(CEFR_LEVELS)
  currentLevel?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianDto)
  guardian?: GuardianDto | null;
}

export class LeaveStudentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class GrantConsentDto {
  @IsIn(CONSENT_KINDS_LIST)
  kind!: ConsentKind;

  @IsUUID()
  grantedByMembershipId!: string;
}

/**
 * `PATCH /students/:id`: semántica de parche, no de reemplazo. Un campo
 * ausente no se toca; el dominio (`Student.changeDateOfBirth`,
 * `Student.changeLevel`) decide si el valor nuevo es aceptable, no este DTO.
 */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateOfBirth debe tener formato AAAA-MM-DD" })
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(CEFR_LEVELS)
  currentLevel?: string | null;
}

/**
 * Tarea 14: importación de alumnado desde CSV. El fichero viaja como texto
 * dentro de un JSON, igual que el resto de la API —sin `multipart/form-data`
 * ni Multer, que esta API no usa en ningún otro sitio—: el cliente lee el
 * `.csv` local y manda su contenido tal cual en este campo.
 */
export class ImportStudentsCsvDto {
  @IsString()
  @MinLength(1)
  csv!: string;
}
