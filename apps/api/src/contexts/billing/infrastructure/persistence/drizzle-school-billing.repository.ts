import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

type SchoolBillingRow = {
  currency: string;
  default_locale: string;
  country: string;
  application_fee_enabled: boolean;
  application_fee_bps: number;
  application_fee_cap_cents: number | null;
  merchant_ref: string | null;
};

/**
 * Configuración de facturación de la escuela activa.
 *
 * Vive aquí, y no en `infrastructure/acl/`, siguiendo el mismo patrón que
 * `DrizzleSchoolLocaleRepository` en `catalog` o `DrizzleSchoolTimezoneRepository`
 * en `scheduling`: RLS ya deja visible una sola escuela dentro de la
 * transacción, así que no hace falta filtrar por id.
 */
@Injectable()
export class DrizzleSchoolBillingRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async find(): Promise<SchoolBillingRow | null> {
    const rows = await this.drizzle.db.execute<SchoolBillingRow>(
      sql`SELECT currency, default_locale, country, application_fee_enabled, application_fee_bps,
                 application_fee_cap_cents, merchant_ref
          FROM schools LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  /**
   * Registra la cuenta de comerciante recién creada (o reutilizada).
   *
   * Sin `WHERE`, igual que `find()`: RLS con `FORCE` ya deja visible (y
   * modificable) una sola fila dentro de esta transacción, la de la escuela
   * activa — filtrar aquí a mano sería repetir lo que ya hace la política.
   * `merchant_status` solo avanza de `not_started` a `pending`: si ya estaba
   * más adelante, un enlace de onboarding nuevo no la hace retroceder.
   */
  async saveMerchantOnboarding(merchantRef: string): Promise<void> {
    await this.drizzle.db.execute(sql`
      UPDATE schools
      SET merchant_ref = ${merchantRef},
          merchant_status = CASE WHEN merchant_status = 'not_started' THEN 'pending' ELSE merchant_status END
    `);
  }

  /** El proveedor confirmó (o restringió) la cuenta. `merchant_onboarded_at` se fija la primera vez que llega a `active`. */
  async updateMerchantStatus(status: "active" | "restricted"): Promise<void> {
    await this.drizzle.db.execute(sql`
      UPDATE schools
      SET merchant_status = ${status},
          merchant_onboarded_at = CASE
            WHEN ${status} = 'active' THEN COALESCE(merchant_onboarded_at, now())
            ELSE merchant_onboarded_at
          END
    `);
  }
}
