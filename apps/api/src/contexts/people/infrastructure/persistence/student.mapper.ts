import * as schema from "@langopia/db/schema";
import type { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Consent, type ConsentKind } from "../../domain/model/consent.vo.js";
import { DateOfBirth } from "../../domain/model/date-of-birth.vo.js";
import { GuardianId, StudentId } from "../../domain/model/identifiers.js";
import { Student, StudentStatus, type Guardian } from "../../domain/model/student.aggregate.js";

/**
 * Formas mínimas que `toDomain` necesita LEER, en vez de los tipos
 * `$inferSelect` completos de Drizzle.
 *
 * Con esto la prueba de ida y vuelta (`student.mapper.spec.ts`) puede pasarle
 * a `toDomain` exactamente lo que devuelve `toPersistence` sin que el
 * compilador se queje: un `$inferInsert` tiene columnas opcionales (las que
 * llevan `default` en el esquema, como `id`) que un `$inferSelect` da por
 * seguras, y aquí no hace falta ni lo uno ni lo otro. Una fila real de
 * Postgres (que tiene TODAS las columnas) sigue encajando igual, porque tener
 * más propiedades de las que un tipo exige nunca rompe la asignación.
 *
 * `status` de `ConsentRow` se deja como `string` ancho a propósito: la
 * columna real admite `pending` y `denied`, que `toDomain` descarta con su
 * propio filtro más abajo; estrecharlo aquí al par que el dominio entiende
 * rechazaría de entrada una fila real con cualquier otro valor.
 */
type StudentRow = {
  id: string;
  schoolId: string;
  membershipId: string;
  dateOfBirth: string;
  status: string;
  pausedUntil: string | null;
  leftReason: string | null;
  currentLevel: string | null;
  nativeLanguage: string;
  targetLanguage: string;
};

type GuardianRow = {
  id: string;
  membershipId: string;
  relationship: Guardian["relationship"];
  canGiveConsent: boolean;
};

type ConsentRow = {
  kind: ConsentKind;
  status: string;
  grantedByMembershipId: string | null;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
  createdAt?: Date;
};

/** Formas que SÍ hace falta escribir, ya listas para `.insert(...).values(...)`. */
type StudentPersistedRow = {
  id: string;
  schoolId: string;
  membershipId: string;
  dateOfBirth: string;
  guardianRequired: boolean;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: CefrLevel | null;
  status: StudentStatus;
  pausedUntil: string | null;
  leftReason: string | null;
};

type GuardianPersistedRow = {
  id: string;
  schoolId: string;
  studentProfileId: string;
  membershipId: string;
  relationship: Guardian["relationship"];
  canGiveConsent: boolean;
};

type ConsentPersistedRow = {
  schoolId: string;
  subjectMembershipId: string;
  kind: ConsentKind;
  status: "granted" | "withdrawn";
  grantedByMembershipId: string | null;
  grantedAt: Date | null;
  withdrawnAt: Date | null;
};

/** Fecha `date` de Postgres a medianoche UTC, igual que `DateOfBirth`. */
function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function utcToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Traductor entre el agregado `Student` y tres tablas: `student_profiles`,
 * `guardians` y `consents`. Sigue el patrón de `ClassSessionMapper`: `toDomain`
 * usa `rehydrate`, que no valida ni emite eventos, y `toPersistence` devuelve
 * las filas listas para escribir.
 */
export class StudentMapper {
  static toDomain(
    row: StudentRow,
    guardianRows: GuardianRow[],
    consentRows: ConsentRow[],
    now: Date,
  ): Student {
    const guardians: Guardian[] = guardianRows.map((g) => ({
      id: GuardianId.of(g.id),
      membershipId: MembershipId.of(g.membershipId),
      relationship: g.relationship,
      canGiveConsent: g.canGiveConsent,
    }));

    // El dominio solo modela dos estados de consentimiento: concedido y
    // retirado. Una fila `pending` o `denied` —estados que hoy solo escribe
    // el seed, no ningún comando de este contexto— se deja fuera del mapa a
    // propósito: si entrara como "retirado", un `save()` posterior la
    // reescribiría con ese estado, perdiendo la distinción sin que ningún
    // comando lo hubiera pedido.
    const consents = new Map<ConsentKind, Consent>();
    for (const c of consentRows) {
      if (c.status !== "granted" && c.status !== "withdrawn") continue;
      const kind = c.kind;
      consents.set(
        kind,
        c.status === "granted" && c.grantedByMembershipId && c.grantedAt
          ? Consent.granted({
              kind,
              grantedBy: MembershipId.of(c.grantedByMembershipId),
              at: c.grantedAt,
            })
          : Consent.withdrawn({ kind, at: c.withdrawnAt ?? c.createdAt ?? now }),
      );
    }

    return Student.rehydrate({
      id: StudentId.of(row.id),
      schoolId: SchoolId.of(row.schoolId),
      membershipId: MembershipId.of(row.membershipId),
      dateOfBirth: DateOfBirth.of(row.dateOfBirth),
      status: row.status as StudentStatus,
      guardians,
      consents,
      pausedUntil: row.pausedUntil ? dateOnlyToUtc(row.pausedUntil) : null,
      leftReason: row.leftReason,
      currentLevel: row.currentLevel as CefrLevel | null,
      nativeLanguage: row.nativeLanguage,
      targetLanguage: row.targetLanguage,
      now,
    });
  }

  static toPersistence(student: Student): {
    student: StudentPersistedRow;
    guardians: GuardianPersistedRow[];
    consents: ConsentPersistedRow[];
  } {
    return {
      student: {
        id: student.id.value,
        schoolId: student.schoolId.value,
        membershipId: student.membershipId.value,
        dateOfBirth: student.dateOfBirth.value,
        guardianRequired: student.guardianRequired,
        nativeLanguage: student.nativeLanguage,
        targetLanguage: student.targetLanguage,
        currentLevel: student.currentLevel,
        status: student.status,
        pausedUntil: student.pausedUntil ? utcToDateOnly(student.pausedUntil) : null,
        leftReason: student.leftReason,
      },
      guardians: student.guardians.map((g) => ({
        id: g.id.value,
        schoolId: student.schoolId.value,
        studentProfileId: student.id.value,
        membershipId: g.membershipId.value,
        relationship: g.relationship,
        canGiveConsent: g.canGiveConsent,
      })),
      consents: [...student.consents.values()].map((consent) => ({
        schoolId: student.schoolId.value,
        subjectMembershipId: student.membershipId.value,
        kind: consent.kind,
        status: consent.granted ? "granted" : "withdrawn",
        grantedByMembershipId: consent.grantedBy?.value ?? null,
        grantedAt: consent.granted ? consent.at : null,
        withdrawnAt: consent.granted ? null : consent.at,
      })),
    };
  }
}
