import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AttendanceStatus } from "../../../domain/model/attendance-status.js";
import { ROOM_PROVIDERS } from "../../../domain/model/room.vo.js";

/**
 * DTO de entrada: la frontera del sistema.
 *
 * Valida la FORMA (esto es un UUID, esto es una fecha ISO). No valida REGLAS
 * de negocio: que el profesor esté libre o que la clase no sea en el pasado
 * lo decide el dominio. Duplicar aquí esas comprobaciones garantiza que un
 * día dejen de coincidir.
 */
export class ScheduleClassSessionDto {
  @IsUUID()
  groupId!: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @IsISO8601()
  startsAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes!: number;

  @IsIn(ROOM_PROVIDERS)
  roomProvider!: string;

  @IsOptional()
  @IsString()
  roomUrl?: string | null;

  @IsOptional()
  @IsString()
  roomExternalId?: string | null;

  @IsOptional()
  @IsString()
  topic?: string | null;

  @IsOptional()
  @IsUUID()
  contentUnitId?: string | null;

  @IsOptional()
  @IsBoolean()
  overrideAvailability?: boolean;
}

export class CancelClassSessionDto {
  @IsIn(["school", "student"])
  party!: "school" | "student";

  @IsString()
  @MinLength(3)
  reason!: string;
}

export class RescheduleClassSessionDto {
  @IsISO8601()
  newStartsAt!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsUUID()
  newTeacherId?: string | null;

  @IsOptional()
  @IsBoolean()
  overrideAvailability?: boolean;
}

class AttendanceEntryDto {
  @IsUUID()
  studentId!: string;

  @IsIn(["present", "absent"])
  status!: "present" | "absent";

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class RecordAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries!: AttendanceEntryDto[];
}

const ATTENDANCE_STATUSES = Object.values(AttendanceStatus) as readonly AttendanceStatus[];

class ImportAttendanceEntryDto {
  @IsUUID()
  studentId!: string;

  @IsIn(ATTENDANCE_STATUSES)
  status!: AttendanceStatus;

  @IsOptional()
  @IsISO8601()
  joinedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  leftAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minutesPresent?: number | null;
}

export class ImportAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportAttendanceEntryDto)
  entries!: ImportAttendanceEntryDto[];
}

/**
 * Rango de fechas. Toda consulta por fechas lo usa: un endpoint que lea
 * `@Query('from')` como `string` suelto acepta basura y revienta con un 500
 * dentro del driver en vez de devolver un 400 explicando qué falta.
 */
export class DateRangeDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}

export class AgendaRangeDto extends DateRangeDto {

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

/** Query de `GET /scheduling/sessions/:id/cancellation-preview` (Tarea 9 del panel). */
export class CancellationPreviewQueryDto {
  @IsIn(["school", "student"])
  party!: "school" | "student";
}
