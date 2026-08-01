import { Inject, Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import {
  ANONYMIZED_SPEAKER_LABEL,
  ERASED_EMAIL_DOMAIN,
  type PersonErasureRepository,
  type PersonEraseTarget,
  type PrivateRecording,
} from "../../domain/ports/person-erasure.port.js";

/**
 * Lado de escritura del borrado seudonimizador.
 *
 * Igual que `DrizzleTranscriptRepository` de la purga de la ola 0: sin
 * ningún filtro por `school_id` a mano, RLS lo hace por debajo. La única
 * excepción deliberada es `hasOtherActiveSchoolMemberships`, explicada junto
 * al método.
 */
@Injectable()
export class DrizzlePersonErasureRepository implements PersonErasureRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async findTarget(membershipId: string): Promise<PersonEraseTarget | null> {
    const rows = await this.drizzle.db.execute<{
      membership_id: string;
      user_id: string;
      role: PersonEraseTarget["role"];
      student_profile_id: string | null;
    }>(sql`
      SELECT m.id AS membership_id, m.user_id, m.role::text AS role, sp.id AS student_profile_id
      FROM memberships m
      LEFT JOIN student_profiles sp ON sp.membership_id = m.id
      WHERE m.id = ${membershipId}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      membershipId: row.membership_id,
      userId: row.user_id,
      role: row.role,
      studentProfileId: row.student_profile_id,
    };
  }

  async isAlreadyErased(userId: string): Promise<boolean> {
    const rows = await this.drizzle.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return rows[0]?.email.endsWith(`@${ERASED_EMAIL_DOMAIN}`) ?? false;
  }

  /**
   * `users` es GLOBAL: la misma fila puede sostener membresías en varias
   * escuelas (un profesor que da clase en dos academias — caso real y ya
   * verificado del seed, Tarea 3 de esta ola). `memberships` tiene RLS: desde
   * esta transacción, cualquier consulta directa a esa tabla solo ve las
   * filas de ESTA escuela, así que no hay forma de detectar la otra
   * membresía sin una vía dedicada.
   *
   * En vez de añadir una función `SECURITY DEFINER` nueva, se reutiliza
   * `memberships_for_auth_user` — la misma que resuelve el tenant al iniciar
   * sesión (`DrizzleMembershipLookupRepository`), ya con `EXECUTE` concedido
   * a `langopia_app` — y se comprueba si alguna de las escuelas que devuelve
   * es distinta de la actual.
   *
   * Límite conocido, documentado en `docs/RGPD.md`: si esta persona NUNCA
   * inició sesión (`users.auth_user_id` es NULL — el caso típico de un
   * alumno, a menudo menor, dado de alta solo por esta escuela), no hay
   * `auth_user_id` con el que preguntar y se asume una única escuela. Cerrar
   * ese hueco del todo pide una función `user_id → escuelas` nueva en
   * `policies.sql`, que esta tarea no añade a propósito: ese fichero lo está
   * editando en paralelo la Tarea 17 (impersonación de soporte), y tocarlo
   * ahora mismo es más riesgo de pisarse que beneficio para un caso límite.
   */
  async hasOtherActiveSchoolMemberships(userId: string): Promise<boolean> {
    const userRows = await this.drizzle.db
      .select({ authUserId: schema.users.authUserId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const authUserId = userRows[0]?.authUserId;
    if (!authUserId) return false;

    const currentSchoolId = this.tenant.schoolId();
    const memberships = await this.drizzle.db.execute<{ schoolId: string }>(sql`
      SELECT "schoolId" FROM memberships_for_auth_user(${authUserId})
    `);
    return memberships.some((m) => m.schoolId !== currentSchoolId);
  }

  async pseudonymizeIdentity(params: {
    userId: string;
    nameMarker: string;
    emailMarker: string;
  }): Promise<void> {
    await this.drizzle.db
      .update(schema.users)
      .set({ name: params.nameMarker, email: params.emailMarker })
      .where(eq(schema.users.id, params.userId));
  }

  /**
   * Sesiones donde ESTE alumno fue el único asistente: nadie más pierde su
   * grabación por este borrado. Una clase de grupo nunca entra aquí, aunque
   * tenga grabación: se anonimiza el enlace de identidad en los segmentos
   * (`anonymizeSpeakerSegments`), pero el fichero se conserva.
   */
  async privateRecordingsOf(studentProfileId: string): Promise<PrivateRecording[]> {
    const rows = await this.drizzle.db.execute<{
      transcript_id: string;
      recording_storage_key: string;
    }>(sql`
      SELECT t.id AS transcript_id, t.recording_storage_key
      FROM transcripts t
      JOIN sessions s ON s.id = t.session_id
      WHERE t.recording_storage_key IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM attendance a
          WHERE a.session_id = s.id AND a.student_profile_id = ${studentProfileId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM attendance a2
          WHERE a2.session_id = s.id AND a2.student_profile_id <> ${studentProfileId}
        )
    `);
    return rows.map((r) => ({
      transcriptId: r.transcript_id,
      recordingStorageKey: r.recording_storage_key,
    }));
  }

  async clearRecording(transcriptId: string): Promise<void> {
    await this.drizzle.db
      .update(schema.transcripts)
      .set({ recordingStorageKey: null, recordingDeletedAt: this.now() })
      .where(eq(schema.transcripts.id, transcriptId));
  }

  async anonymizeSpeakerSegments(membershipId: string): Promise<number> {
    const updated = await this.drizzle.db
      .update(schema.transcriptSegments)
      .set({ speakerMembershipId: null, speakerLabel: ANONYMIZED_SPEAKER_LABEL })
      .where(eq(schema.transcriptSegments.speakerMembershipId, membershipId))
      .returning({ id: schema.transcriptSegments.id });
    return updated.length;
  }

  /** `CLOCK` no es un puerto que este repositorio reciba: es un detalle de escritura, no una regla de negocio. */
  private now(): Date {
    return new Date();
  }
}
