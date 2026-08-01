import { Inject, Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, sql } from "drizzle-orm";
import { NotFoundError } from "../../../shared/domain/errors/domain-error.js";
import { CLOCK, type Clock } from "../../../shared/domain/ports/clock.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { StudentId } from "../../domain/model/identifiers.js";
import type { Student } from "../../domain/model/student.aggregate.js";
import type { StudentRepository } from "../../domain/ports/student.repository.port.js";
import { StudentMapper } from "./student.mapper.js";

/**
 * Implementación del repositorio sobre Drizzle.
 *
 * Ninguna consulta filtra por `school_id` a mano: la conexión lleva el rol
 * `langopia_app` y la transacción fija `app.school_id`, así que RLS lo filtra
 * todo por debajo. Añadir el filtro aquí daría una falsa sensación de
 * seguridad.
 */
@Injectable()
export class DrizzleStudentRepository implements StudentRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async find(id: StudentId): Promise<Student | null> {
    const rows = await this.drizzle.db
      .select()
      .from(schema.studentProfiles)
      .where(eq(schema.studentProfiles.id, id.value))
      .limit(1);
    const row = rows[0];
    if (!row) return null;

    const [guardianRows, consentRows] = await Promise.all([
      this.drizzle.db
        .select()
        .from(schema.guardians)
        .where(eq(schema.guardians.studentProfileId, row.id)),
      this.drizzle.db
        .select()
        .from(schema.consents)
        .where(eq(schema.consents.subjectMembershipId, row.membershipId)),
    ]);

    // `now` es el instante de la LECTURA: así `guardianRequired` refleja la
    // edad actual del alumno, no la que tenía cuando se creó la fila.
    return StudentMapper.toDomain(row, guardianRows, consentRows, this.clock.now());
  }

  async findOrFail(id: StudentId): Promise<Student> {
    const student = await this.find(id);
    if (!student) throw new NotFoundError("el alumno", id.value);
    return student;
  }

  async save(student: Student): Promise<void> {
    const { student: row, guardians, consents } = StudentMapper.toPersistence(student);

    await this.drizzle.db
      .insert(schema.studentProfiles)
      .values(row)
      .onConflictDoUpdate({
        target: schema.studentProfiles.id,
        set: {
          dateOfBirth: row.dateOfBirth,
          guardianRequired: row.guardianRequired,
          nativeLanguage: row.nativeLanguage,
          targetLanguage: row.targetLanguage,
          currentLevel: row.currentLevel,
          status: row.status,
          pausedUntil: row.pausedUntil ?? null,
          leftReason: row.leftReason ?? null,
        },
      });

    // En serie y dentro de la transacción que abrió la unidad de trabajo: o
    // se guarda todo o nada. La cardinalidad por alumno es baja (como mucho
    // un puñado de tutores y seis tipos de consentimiento), así que no hace
    // falta un `insert` masivo.
    for (const guardian of guardians) {
      await this.drizzle.db
        .insert(schema.guardians)
        .values(guardian)
        .onConflictDoUpdate({
          target: schema.guardians.id,
          set: {
            relationship: guardian.relationship,
            canGiveConsent: guardian.canGiveConsent,
          },
        });
    }

    for (const consent of consents) {
      await this.drizzle.db
        .insert(schema.consents)
        .values(consent)
        .onConflictDoUpdate({
          target: [schema.consents.subjectMembershipId, schema.consents.kind],
          set: {
            status: consent.status,
            grantedByMembershipId: consent.grantedByMembershipId ?? null,
            grantedAt: consent.grantedAt ?? null,
            withdrawnAt: consent.withdrawnAt ?? null,
          },
        });
    }
  }

  async countActive(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.studentProfiles)
      .where(eq(schema.studentProfiles.status, "active"));
    return rows[0]?.count ?? 0;
  }
}
