/**
 * Lo que `assessment` necesita de los créditos de IA de `billing`, en su
 * propio lenguaje: reservar antes de generar un examen y devolver después.
 * Copia propia del puerto, no el de `learning`
 * (`learning/domain/ports/credit-ledger.port.ts`) — cruzar ese fichero
 * ataría este contexto a un cambio en otro (`ARCHITECTURE.md`, «Puerto +
 * capa anticorrupción»). El adaptador
 * (`infrastructure/acl/billing-credit-ledger.adapter.ts`) opera sobre las
 * MISMAS tablas (`schools.ai_credits_balance`, `credit_ledger`) con su
 * propio repositorio, igual que `learning` ya hace con las suyas.
 */
export interface CreditLedgerPort {
  /**
   * Reserva créditos ANTES de llamar a ningún modelo (regla de la ola: «con
   * `ai_hard_limit` y saldo cero, la generación se rechaza»). Si el tope
   * duro lo impide, lanza `InsufficientCreditsError` y no reserva nada.
   */
  spend(params: {
    credits: number;
    costCents?: number;
    note: string;
    aiGenerationId?: string | null;
  }): Promise<void>;

  /**
   * Devuelve créditos: la reserva entera de una generación fallida, o la
   * diferencia sobrante de una que costó menos de lo estimado. Nunca se
   * rechaza por tope duro.
   */
  refund(params: { credits: number; note: string; aiGenerationId?: string | null }): Promise<void>;
}

export const CREDIT_LEDGER_PORT = Symbol("CreditLedgerPort");
