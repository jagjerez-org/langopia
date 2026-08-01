export interface CreditLedgerPort {
  spend(params: {
    credits: number;
    costCents?: number;
    note: string;
    aiGenerationId?: string | null;
  }): Promise<void>;

  refund(params: { credits: number; note: string; aiGenerationId?: string | null }): Promise<void>;
}

export const CREDIT_LEDGER_PORT = Symbol("ClassroomCreditLedgerPort");
