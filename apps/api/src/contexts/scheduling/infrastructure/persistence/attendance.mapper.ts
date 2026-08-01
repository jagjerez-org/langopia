import * as schema from "@langopia/db/schema";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { AttendanceEntry } from "../../domain/model/attendance-entry.entity.js";
import type { AttendanceSource, AttendanceStatus } from "../../domain/model/attendance-status.js";
import { AttendanceId, SessionId, StudentId } from "../../domain/model/identifiers.js";

type AttendanceRow = typeof schema.attendance.$inferSelect;
type AttendanceInsert = typeof schema.attendance.$inferInsert;

/**
 * Traductor entre la fila de `attendance` y la entidad `AttendanceEntry`.
 *
 * Igual criterio que `ClassSessionMapper`: `toDomain` usa `rehydrate` — lo
 * guardado ya pasó las reglas, no se vuelven a comprobar al leer.
 */
export class AttendanceMapper {
  static toDomain(row: AttendanceRow): AttendanceEntry {
    return AttendanceEntry.rehydrate({
      id: AttendanceId.of(row.id),
      sessionId: SessionId.of(row.sessionId),
      studentId: StudentId.of(row.studentProfileId),
      status: row.status as AttendanceStatus,
      source: row.source as AttendanceSource,
      joinedAt: row.joinedAt,
      leftAt: row.leftAt,
      minutesPresent: row.minutesPresent,
      note: row.note,
      recordedByMembershipId: row.recordedByMembershipId
        ? MembershipId.of(row.recordedByMembershipId)
        : null,
      createdAt: row.createdAt,
    });
  }

  static toPersistence(entry: AttendanceEntry, schoolId: SchoolId): AttendanceInsert {
    return {
      id: entry.id.value,
      schoolId: schoolId.value,
      sessionId: entry.sessionId.value,
      studentProfileId: entry.studentId.value,
      status: entry.status,
      source: entry.source,
      joinedAt: entry.joinedAt,
      leftAt: entry.leftAt,
      minutesPresent: entry.minutesPresent,
      note: entry.note,
      recordedByMembershipId: entry.recordedByMembershipId?.value ?? null,
    };
  }
}
