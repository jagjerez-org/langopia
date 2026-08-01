import { Injectable } from "@nestjs/common";
import type { CreditLedgerPort } from "../../domain/ports/credit-ledger.port.js";
import { DrizzleCreditLedgerRepository } from "../persistence/drizzle-credit-ledger.repository.js";

/**
 * Capa anticorrupción hacia el contexto de Facturación.
 *
 * `assessment` necesita reservar y devolver créditos para generar exámenes,
 * y no debe saber nada más de cómo `billing` los guarda. Delega en
 * `DrizzleCreditLedgerRepository` (`infrastructure/persistence/`): el
 * adaptador no escribe SQL.
 */
@Injectable()
export class BillingCreditLedgerAdapter implements CreditLedgerPort {
  constructor(private readonly repository: DrizzleCreditLedgerRepository) {}

  spend(params: {
    credits: number;
    costCents?: number;
    note: string;
    aiGenerationId?: string | null;
  }): Promise<void> {
    return this.repository.spend(params);
  }

  refund(params: { credits: number; note: string; aiGenerationId?: string | null }): Promise<void> {
    return this.repository.refund(params);
  }
}
