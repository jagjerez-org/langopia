/**
 * Lo que `learning` necesita de los créditos de IA de `billing`, en su propio
 * lenguaje: reservar antes de generar y devolver después. Sigue el patrón de
 * `ARCHITECTURE.md` («Puerto + capa anticorrupción»): el puerto lo declara
 * quien pregunta, aquí, no `billing`. `learning` no importa
 * `CreditBalance`, `SpendCreditsCommand` ni ningún otro fichero de
 * `contexts/billing/` —eso cruzaría la frontera entre contextos («un
 * contexto no despacha el comando de otro»)—; el adaptador
 * (`infrastructure/acl/billing-credit-ledger.adapter.ts`) opera sobre las
 * MISMAS tablas (`schools.ai_credits_balance`, `credit_ledger`) con su propio
 * repositorio, igual que `DrizzleExerciseSourceRepository` (`assessment`) lee
 * `exercises`/`rubrics` sin importar nada de `learning`.
 */
export interface CreditLedgerPort {
  /**
   * Reserva créditos ANTES de llamar a ningún modelo (regla de la ola:
   * «con `ai_hard_limit` y saldo cero, la generación se rechaza»). Si el tope
   * duro lo impide, lanza `InsufficientCreditsError`
   * (`learning/domain/errors/learning.errors.ts`) y no reserva nada — quien
   * llama no debe haber generado todavía.
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
   * rechaza por tope duro — ese tope protege de gastar de más, no de
   * recuperar una reserva.
   */
  refund(params: { credits: number; note: string; aiGenerationId?: string | null }): Promise<void>;
}

export const CREDIT_LEDGER_PORT = Symbol("CreditLedgerPort");
