import { Inject, Injectable } from "@nestjs/common";
import * as schema from "@langopia/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  TENANT_CONTEXT,
  type TenantContext,
} from "../../../shared/domain/ports/tenant-context.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { School } from "../../domain/model/school.aggregate.js";
import type {
  SchoolRepositoryPort,
  SchoolSettings,
  UpdateSchoolSettingsInput,
} from "../../domain/ports/school-repository.port.js";

/**
 * Implementación sobre Drizzle.
 *
 * `save` solo fija las columnas que el brief de la Tarea 11 (backend)
 * convierte en regla: el resto (país, moneda, comisión, créditos de IA...)
 * se queda con el valor por defecto del esquema. `existsBySlug`,
 * `findCurrent` y `updateSettings` son de la Tarea 12 del panel.
 */
@Injectable()
export class DrizzleSchoolRepository implements SchoolRepositoryPort {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async save(school: School): Promise<void> {
    await this.drizzle.db.insert(schema.schools).values({
      id: school.id.value,
      slug: school.slug.value,
      name: school.name,
      status: school.status,
      trialEndsAt: school.trialEndsAt,
    });
  }

  /**
   * Sin tenant, igual que `save`: usa `connection` (la conexión suelta), no
   * `db`. `schools` tiene RLS por `id`, no por `slug` — sin la función
   * `SECURITY DEFINER` `school_slug_is_taken` (`packages/db/src/policies.sql`),
   * cualquier `SELECT ... WHERE slug = ...` vería siempre cero filas, slug
   * libre o no.
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const rows = await this.drizzle.connection.execute<{ taken: boolean }>(
      sql`SELECT school_slug_is_taken(${slug}) AS taken`,
    );
    return rows[0]?.taken ?? false;
  }

  /**
   * `LIMIT 1` sin más filtro, como `DrizzleSchoolTimezoneRepository`: RLS deja
   * visible una sola escuela. Quien llama debe envolver esto en `uow.read()`
   * — fuera de una transacción con `app.school_id` fijado, esta consulta ha
   * demostrado devolver la escuela equivocada, no ninguna (ver el comentario
   * de `GetSchoolTimezoneHandler`).
   */
  async findCurrent(): Promise<SchoolSettings | null> {
    const rows = await this.drizzle.db.execute<{
      name: string;
      defaultLocale: string;
      supportedLocales: string[];
      status: SchoolSettings["status"];
      trialEndsAt: Date | string | null;
    }>(sql`
      SELECT name,
             default_locale AS "defaultLocale",
             supported_locales AS "supportedLocales",
             status,
             trial_ends_at AS "trialEndsAt"
      FROM schools
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    // `sql\`...\`` en crudo, a diferencia del constructor de consultas
    // tipado, no pasa `trial_ends_at` por el mapeo de columnas de Drizzle:
    // llega como texto ISO, no como `Date`. Se normaliza aquí, una vez, para
    // que el resto de la aplicación pueda confiar en el tipo que declara el
    // puerto (`SchoolSettings.trialEndsAt: Date | null`).
    return { ...row, trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt) : null };
  }

  /**
   * `supportedLocales` no llega en `input` desde el DTO: `updateSettings` lo
   * decide `UpdateSchoolSettingsHandler`, para que nunca quede un
   * `defaultLocale` fuera de `supportedLocales` (`CreateCourseDialog` del
   * panel solo pide traducción para los idiomas de `supportedLocales`; si
   * `defaultLocale` no estuviera entre ellos, un curso no podría nacer
   * nunca, porque `Course.create()` exige la traducción del idioma por
   * defecto).
   */
  async updateSettings(input: UpdateSchoolSettingsInput): Promise<SchoolSettings> {
    const set: Partial<typeof schema.schools.$inferInsert> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.defaultLocale !== undefined) set.defaultLocale = input.defaultLocale;
    if (input.supportedLocales !== undefined) set.supportedLocales = input.supportedLocales;

    const [row] = await this.drizzle.db
      .update(schema.schools)
      .set(set)
      .where(eq(schema.schools.id, this.tenant.schoolId()))
      .returning({
        name: schema.schools.name,
        defaultLocale: schema.schools.defaultLocale,
        supportedLocales: schema.schools.supportedLocales,
        status: schema.schools.status,
        trialEndsAt: schema.schools.trialEndsAt,
      });
    if (!row) throw new Error("No se pudo actualizar la escuela activa: no se encontró la fila.");
    return row;
  }
}
