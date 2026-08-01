import { Injectable } from "@nestjs/common";
import type {
  MerchantStatus,
  SchoolBillingPolicyPort,
} from "../../domain/ports/school-billing-policy.port.js";
import { DrizzleSchoolBillingRepository } from "../persistence/drizzle-school-billing.repository.js";

const DEFAULT_CURRENCY = "EUR";
const DEFAULT_LOCALE_FALLBACK = "es-ES";
const DEFAULT_COUNTRY = "ES";

/**
 * Configuración de la escuela que afecta a la facturación.
 *
 * El acceso a datos vive en `DrizzleSchoolBillingRepository`
 * (`infrastructure/persistence/`): este adaptador delega, no escribe SQL —
 * mismo reparto que `SchoolCatalogLocaleAdapter` en `catalog`.
 */
@Injectable()
export class SchoolBillingPolicyAdapter implements SchoolBillingPolicyPort {
  constructor(private readonly repository: DrizzleSchoolBillingRepository) {}

  async currency(): Promise<string> {
    const row = await this.repository.find();
    return row?.currency ?? DEFAULT_CURRENCY;
  }

  async defaultLocale(): Promise<string> {
    const row = await this.repository.find();
    return row?.default_locale ?? DEFAULT_LOCALE_FALLBACK;
  }

  async applicationFee(): Promise<{ enabled: boolean; bps: number; capCents: number | null }> {
    const row = await this.repository.find();
    return {
      enabled: row?.application_fee_enabled ?? false,
      bps: row?.application_fee_bps ?? 0,
      capCents: row?.application_fee_cap_cents ?? null,
    };
  }

  async merchantRef(): Promise<string | null> {
    const row = await this.repository.find();
    return row?.merchant_ref ?? null;
  }

  async country(): Promise<string> {
    const row = await this.repository.find();
    return row?.country ?? DEFAULT_COUNTRY;
  }

  async saveMerchantOnboarding(merchantRef: string): Promise<void> {
    await this.repository.saveMerchantOnboarding(merchantRef);
  }

  async updateMerchantStatus(status: MerchantStatus): Promise<void> {
    await this.repository.updateMerchantStatus(status);
  }
}
