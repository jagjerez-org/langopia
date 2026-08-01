import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { AttendanceEntry } from "../../domain/model/attendance-entry.entity.js";
import type { AttendanceSheet } from "../../domain/model/attendance.aggregate.js";
import type { SessionId } from "../../domain/model/identifiers.js";
import type { AttendanceRepository } from "../../domain/ports/attendance.repository.port.js";
import { AttendanceMapper } from "./attendance.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * `save` guarda TODAS las entradas de la hoja en cada llamada, no solo las
 * nuevas: una clase tiene como mucho unas pocas decenas de alumnos, y guardar
 * de más aquí es mucho más simple que llevar la cuenta de qué entrada cambió.
 * El conflicto se resuelve por la pareja (`session_id`, `student_profile_id`)
 * —la clave real de una entrada de asistencia—, no por `id`: así una
 * corrección posterior actualiza la fila que ya existía en vez de duplicarla.
 */
@Injectable()
export class DrizzleAttendanceRepository implements AttendanceRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async findEntries(sessionId: SessionId): Promise<AttendanceEntry[]> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.attendance)
      .where(eq(schema.attendance.sessionId, sessionId.value));
    return rows.map(AttendanceMapper.toDomain);
  }

  async save(sheet: AttendanceSheet): Promise<void> {
    for (const entry of sheet.entries) {
      const row = AttendanceMapper.toPersistence(entry, sheet.schoolId);
      await this.drizzle.db
        .insert(schema.attendance)
        .values(row)
        .onConflictDoUpdate({
          target: [schema.attendance.sessionId, schema.attendance.studentProfileId],
          set: {
            status: row.status,
            source: row.source,
            joinedAt: row.joinedAt ?? null,
            leftAt: row.leftAt ?? null,
            minutesPresent: row.minutesPresent ?? null,
            note: row.note ?? null,
            recordedByMembershipId: row.recordedByMembershipId ?? null,
          },
        });
    }
  }
}
