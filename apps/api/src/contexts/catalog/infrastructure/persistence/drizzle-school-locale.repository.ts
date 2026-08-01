import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

/**
 * Configuración de la escuela que Catalog necesita leer.
 *
 * Vive aquí, y no en `infrastructure/acl/`, siguiendo el mismo patrón que
 * `DrizzleSchoolTimezoneRepository` en `scheduling`.
 */
@Injectable()
export class DrizzleSchoolLocaleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async defaultLocale(): Promise<string | null> {
    // RLS deja visible una sola escuela, así que no hace falta filtrar por id.
    const rows = await this.drizzle.db.execute<{ default_locale: string }>(
      sql`SELECT default_locale FROM schools LIMIT 1`,
    );
    return rows[0]?.default_locale ?? null;
  }

  async supportedLocales(): Promise<string[] | null> {
    const rows = await this.drizzle.db.execute<{ supported_locales: string[] }>(
      sql`SELECT supported_locales FROM schools LIMIT 1`,
    );
    return rows[0]?.supported_locales ?? null;
  }
}
