import type { CreditBalance } from "../model/credit-balance.aggregate.js";

/**
 * Repositorio del agregado `CreditBalance`.
 *
 * Una escuela tiene un único saldo (vive en `schools.ai_credits_balance` /
 * `ai_hard_limit`, no en una tabla propia), así que no hay `find(id)`: la
 * escuela activa la fija RLS, igual que `SchoolBillingPolicyPort`.
 */
export interface CreditBalanceRepository {
  /**
   * Carga el saldo de la escuela activa CON BLOQUEO DE FILA
   * (`SELECT ... FOR UPDATE`), dentro de la transacción de `uow.execute()`.
   *
   * Es aquí, y no en el agregado, donde se resuelve de verdad que «dos
   * generaciones simultáneas con saldo para una sola no pueden pasar las
   * dos»: la segunda transacción que llegue a este método espera a que la
   * primera confirme (o deshaga) antes de leer el saldo, así que nunca lo ve
   * «viejo». Una comprobación en memoria sin este bloqueo no basta —ambas
   * leerían el mismo saldo a la vez y las dos pasarían la comprobación.
   */
  findForUpdate(): Promise<CreditBalance>;

  /**
   * Persiste el saldo resultante y añade una fila nueva al libro mayor por
   * cada movimiento pendiente (`CreditBalance.pullMovements()`) — nunca
   * actualiza una fila existente.
   */
  save(balance: CreditBalance): Promise<void>;
}

export const CREDIT_BALANCE_REPOSITORY = Symbol("CreditBalanceRepository");
