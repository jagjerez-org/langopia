import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { HourlyRate, type TeacherTier } from "../../domain/model/hourly-rate.vo.js";
import { TeacherId } from "../../domain/model/identifiers.js";
import { Teacher, type TeacherStatus } from "../../domain/model/teacher.aggregate.js";
import { WeeklyAvailability, type AvailabilitySlot } from "../../domain/model/weekly-availability.vo.js";

/**
 * Formas mínimas que `toDomain` necesita LEER. Igual razón que
 * `StudentMapper`: así la prueba de ida y vuelta puede pasarle a `toDomain`
 * exactamente lo que devuelve `toPersistence`, y una fila real de Postgres
 * (con más columnas de las que aquí se piden) sigue encajando igual.
 */
type TeacherRow = {
  id: string;
  schoolId: string;
  membershipId: string;
  tier: string;
  hourlyRateCents: number;
  contractedHoursWeek: number;
  status: string;
  hiredAt: string;
  leftReason: string | null;
};

type AvailabilityRow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

/** Formas que SÍ hace falta escribir, ya listas para `.insert(...).values(...)`. */
type TeacherPersistedRow = {
  id: string;
  schoolId: string;
  membershipId: string;
  tier: TeacherTier;
  hourlyRateCents: number;
  contractedHoursWeek: number;
  status: TeacherStatus;
  hiredAt: string;
  leftReason: string | null;
};

type AvailabilityPersistedRow = {
  schoolId: string;
  teacherProfileId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};

/** Fecha `date` de Postgres a medianoche UTC. Igual convención que `StudentMapper`. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function utcToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Traductor entre el agregado `Teacher` y dos tablas: `teacher_profiles` y
 * `teacher_availability`. Sigue el patrón de `StudentMapper`: `toDomain` usa
 * `rehydrate`, que no valida invariantes de alta ni emite eventos, y
 * `toPersistence` devuelve las filas listas para escribir.
 *
 * No escribe `bio`, `languages`, `certifications`, `isNativeSpeaker` ni
 * `currency`: el dominio de esta tarea no modela esos campos (ninguna regla
 * de negocio depende de ellos) y todos tienen `default` en el esquema, así
 * que Postgres los rellena solo al insertar.
 */
export class TeacherMapper {
  static toDomain(row: TeacherRow, availabilityRows: AvailabilityRow[]): Teacher {
    const slots: AvailabilitySlot[] = availabilityRows.map((a) => ({
      weekday: a.weekday,
      startMinute: a.startMinute,
      endMinute: a.endMinute,
    }));

    return Teacher.rehydrate({
      id: TeacherId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      membershipId: MembershipId.of(row.membershipId),
      hourlyRate: HourlyRate.of(row.tier as TeacherTier, row.hourlyRateCents),
      contractedHoursPerWeek: row.contractedHoursWeek,
      availability: WeeklyAvailability.of(slots),
      status: row.status as TeacherStatus,
      hiredAt: dateOnlyToUtc(row.hiredAt),
      leftReason: row.leftReason,
    });
  }

  static toPersistence(teacher: Teacher): {
    teacher: TeacherPersistedRow;
    availability: AvailabilityPersistedRow[];
  } {
    return {
      teacher: {
        id: teacher.id.value,
        schoolId: teacher.schoolId.value,
        membershipId: teacher.membershipId.value,
        tier: teacher.hourlyRate.tier,
        hourlyRateCents: teacher.hourlyRate.cents,
        contractedHoursWeek: teacher.contractedHoursPerWeek,
        status: teacher.status,
        hiredAt: utcToDateOnly(teacher.hiredAt),
        leftReason: teacher.leftReason,
      },
      availability: teacher.availability.slots.map((slot) => ({
        schoolId: teacher.schoolId.value,
        teacherProfileId: teacher.id.value,
        weekday: slot.weekday,
        startMinute: slot.startMinute,
        endMinute: slot.endMinute,
      })),
    };
  }
}
