import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Zona horaria de la escuela activa, que `learning` necesita para saber qué
 * día es «hoy» al programar un repaso (tarea 9).
 *
 * Copia deliberada de `scheduling/infrastructure/persistence/drizzle-school-timezone.repository.ts`:
 * un contexto no importa el repositorio de otro (`ARCHITECTURE.md`, «un
 * contexto no despacha el comando de otro» — el mismo principio se aplica a
 * su infraestructura), así que cada uno lee la misma tabla con su propia
 * clase. Coste asumido, no un despiste (ver el informe de la tarea 9).
 */
@Injectable()
export class DrizzleSchoolTimezoneRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async timezone(): Promise<string | null> {
    // RLS deja visible una sola escuela, así que no hace falta filtrar por id.
    const rows = await this.drizzle.db.execute<{ timezone: string }>(
      sql`SELECT timezone FROM schools LIMIT 1`,
    );
    return rows[0]?.timezone ?? null;
  }
}
