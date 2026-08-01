import { Injectable } from "@nestjs/common";
import type { CreditLedgerPort } from "../../domain/ports/credit-ledger.port.js";
import { DrizzleCreditLedgerRepository } from "../persistence/drizzle-credit-ledger.repository.js";

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
