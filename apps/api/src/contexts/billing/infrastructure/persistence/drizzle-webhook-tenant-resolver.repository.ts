import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import type { WebhookTenantResolverPort } from "../../domain/ports/webhook-tenant-resolver.port.js";

/**
 * Resuelve a qué escuela pertenece un evento entrante, ANTES de que exista
 * ningún tenant que fijar.
 *
 * Usa `connection` y no `db`, a propósito: es la misma razón que
 * `DrizzleMembershipLookupRepository` en `iam` — esta consulta averigua QUÉ
 * escuela hay que fijar, así que por definición corre antes de que
 * `app.school_id` tenga ningún valor. Con RLS `FORCE` y el rol `langopia_app`
 * sin ese contexto, `schools`/`payments` devolverían cero filas.
 *
 * Por eso no consulta las tablas directamente: llama a dos funciones
 * `SECURITY DEFINER` declaradas en `packages/db/src/policies.sql`
 * (`school_id_for_merchant_ref`, `school_id_for_charge_ref`), cada una un
 * agujero del tamaño exacto de la pregunta que resuelve — nada de `SELECT *
 * FROM schools`, un `uuid` o nada. El rol de la aplicación sigue sin
 * `BYPASSRLS`.
 */
@Injectable()
export class DrizzleWebhookTenantResolverRepository implements WebhookTenantResolverPort {
  constructor(private readonly drizzle: DrizzleService) {}

  async schoolIdForMerchantRef(merchantRef: string): Promise<string | null> {
    const rows = await this.drizzle.connection.execute<{ school_id: string | null }>(
      sql`SELECT school_id_for_merchant_ref(${merchantRef}) AS school_id`,
    );
    return rows[0]?.school_id ?? null;
  }

  async schoolIdForChargeRef(chargeRef: string): Promise<string | null> {
    const rows = await this.drizzle.connection.execute<{ school_id: string | null }>(
      sql`SELECT school_id_for_charge_ref(${chargeRef}) AS school_id`,
    );
    return rows[0]?.school_id ?? null;
  }
}
