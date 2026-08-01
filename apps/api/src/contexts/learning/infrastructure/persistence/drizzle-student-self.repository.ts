import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Acceso a datos de `people` que necesita `learning`: si una membresía es la
 * titular de una ficha de alumno, o su tutor legal. Vive en un repositorio,
 * no en `infrastructure/acl/`, por el mismo motivo que
 * `DrizzleStudentMinorRepository` de `assessment`: el acceso a datos vive
 * aquí, y el adaptador (`PeopleStudentSelfAdapter`) solo delega. `student_
 * profiles` y `guardians` son de `people`; esto no es un cruce de dominio,
 * es SQL crudo contra el esquema compartido, igual que el resto de
 * repositorios de esta ola que leen tablas de un contexto vecino.
 *
 * Abre su PROPIA `uow.read()`, a diferencia del equivalente de `assessment`
 * (que siempre lo llama un manejador ya dentro de una transacción): su único
 * llamador, `ExercisesController`, es una guarda de acceso que corre ANTES de
 * entrar en ninguna. Sin `uow.read()` no hay `app.school_id` fijado y RLS no
 * devuelve ninguna fila, así que la comprobación decía «no eres tú» hasta al
 * propio alumno — que es exactamente lo que pasaba al probarlo contra el seed
 * antes de este cambio.
 */
@Injectable()
export class DrizzleStudentSelfRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async isSelfOrGuardian(membershipId: string, studentProfileId: string): Promise<boolean> {
    return this.uow.read(async () => {
      const rows = await this.drizzle.db.execute<{ ok: boolean }>(sql`
        SELECT true AS ok
        FROM student_profiles sp
        WHERE sp.id = ${studentProfileId}
          AND (
            sp.membership_id = ${membershipId}
            OR EXISTS (
              SELECT 1 FROM guardians g
              WHERE g.student_profile_id = sp.id AND g.membership_id = ${membershipId}
            )
          )
        LIMIT 1
      `);
      return rows.length > 0;
    });
  }
}
