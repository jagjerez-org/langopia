import { AggregateRoot } from "../../../shared/domain/primitives/entity.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { InsufficientCreditsError, InvalidCreditAmountError } from "../errors/billing.errors.js";

/** Espejo de `credit_reason` (`packages/db/src/schema/enums.ts`). */
export const CreditReason = {
  /** Créditos incluidos en el plan, cada renovación. */
  PlanGrant: "plan_grant",
  /** Recarga comprada. */
  Topup: "topup",
  /** Consumo por una generación. */
  Generation: "generation",
  /** Devolución por una generación fallida, o el ajuste de una sobreestimación. */
  Refund: "refund",
  /** Ajuste manual de la plataforma. */
  Adjustment: "adjustment",
} as const;

export type CreditReason = (typeof CreditReason)[keyof typeof CreditReason];

/**
 * Un movimiento del libro mayor, listo para que el repositorio lo persista
 * como una fila NUEVA de `credit_ledger` — nunca se actualiza una fila
 * existente. `balanceAfter` es el saldo ya resultante, para poder auditar sin
 * sumar toda la tabla.
 */
export type CreditMovement = {
  delta: number;
  balanceAfter: number;
  reason: CreditReason;
  costCents: number;
  aiGenerationId: string | null;
  note: string | null;
  now: Date;
};

/**
 * Saldo de créditos de IA de una escuela.
 *
 * Es el agregado que protege el margen: sin él, nada impide que una escuela
 * genere contenido sin límite. Su identidad ES la escuela —una escuela tiene
 * un único saldo, no una colección de saldos—, así que se identifica por
 * `SchoolId` en vez de por un id propio.
 *
 * Lo que NO está aquí, y por qué:
 *
 *   · Las FILAS del libro mayor no son entidades de este agregado, igual que
 *     `Payment`/`Refund` no lo son de `Invoice`: son hechos que ya ocurrieron.
 *     Cada `grant()`/`spend()`/`refund()` acumula un `CreditMovement` que el
 *     repositorio inserta tal cual — `pullMovements()`, simétrico a
 *     `pullDomainEvents()`, es la única vía de salida.
 *
 *   · Que la generación sea rechazada al llegar a saldo cero con
 *     `ai_hard_limit` no basta con comprobarlo aquí: dos gastos concurrentes
 *     leyendo el mismo saldo en memoria pueden pasar los dos. La garantía real
 *     vive en el repositorio (`findForUpdate()`, con bloqueo de fila real en
 *     Postgres): este agregado solo decide la regla de negocio UNA VEZ que ya
 *     tiene el saldo correcto, serializado por la base de datos.
 */
export class CreditBalance extends AggregateRoot<SchoolId> {
  private _movements: CreditMovement[] = [];

  private constructor(
    schoolId: SchoolId,
    private _balance: number,
    private readonly _hardLimit: boolean,
  ) {
    super(schoolId);
  }

  /** Reconstruye desde persistencia. No valida ni emite eventos: ya ocurrió. */
  static rehydrate(params: { schoolId: SchoolId; balance: number; hardLimit: boolean }): CreditBalance {
    return new CreditBalance(params.schoolId, params.balance, params.hardLimit);
  }

  /**
   * Concede créditos: la recarga comprada, el ajuste manual, o los incluidos
   * en la renovación del plan.
   *
   * `cap`, si se pasa, es el TOPE del saldo resultante — «la renovación del
   * plan concede los créditos incluidos sin acumular indefinidamente: el tope
   * es dos veces los del plan» (brief). Con el saldo ya en el tope o por
   * encima, no concede nada: no es un error, es que no hay hueco que llenar.
   */
  grant(params: { credits: number; reason: CreditReason; note?: string | null; cap?: number | null; now: Date }): void {
    this.assertPositiveAmount(params.credits);

    const room = params.cap != null ? Math.max(0, params.cap - this._balance) : params.credits;
    const toGrant = Math.min(params.credits, room);
    if (toGrant === 0) return;

    this._balance += toGrant;
    this.pushMovement({
      delta: toGrant,
      reason: params.reason,
      costCents: 0,
      aiGenerationId: null,
      note: params.note ?? null,
      now: params.now,
    });
  }

  /**
   * Gasta créditos: la reserva que se pide ANTES de llamar a ningún modelo
   * (brief, Tarea 6, pasos 1-2), y también el ajuste posterior si el coste
   * real resultó ser MAYOR que lo reservado.
   *
   * Con `ai_hard_limit` y el saldo insuficiente, se rechaza: no se genera
   * «fiado». Sin él, se permite y el saldo queda negativo — avisar de eso es
   * cosa de quien llama (el manejador tiene logger; este agregado, no).
   */
  spend(params: {
    credits: number;
    costCents?: number;
    note?: string | null;
    aiGenerationId?: string | null;
    now: Date;
  }): void {
    this.assertPositiveAmount(params.credits);

    const newBalance = this._balance - params.credits;
    if (this._hardLimit && newBalance < 0) {
      throw new InsufficientCreditsError(this.id.value, params.credits, this._balance);
    }

    this._balance = newBalance;
    this.pushMovement({
      delta: -params.credits,
      reason: CreditReason.Generation,
      costCents: params.costCents ?? 0,
      aiGenerationId: params.aiGenerationId ?? null,
      note: params.note ?? null,
      now: params.now,
    });
  }

  /**
   * Devuelve créditos: una generación fallida que no se cobra («el cliente no
   * paga por lo que no recibió»), o la diferencia de una reserva que se
   * estimó de más. Nunca se rechaza por `ai_hard_limit` — ese tope protege de
   * gastar de más, no de recuperar lo ya reservado.
   */
  refund(params: { credits: number; note?: string | null; aiGenerationId?: string | null; now: Date }): void {
    this.assertPositiveAmount(params.credits);

    this._balance += params.credits;
    this.pushMovement({
      delta: params.credits,
      reason: CreditReason.Refund,
      costCents: 0,
      aiGenerationId: params.aiGenerationId ?? null,
      note: params.note ?? null,
      now: params.now,
    });
  }

  private assertPositiveAmount(credits: number): void {
    if (!Number.isInteger(credits) || credits <= 0) {
      throw new InvalidCreditAmountError(credits);
    }
  }

  private pushMovement(movement: Omit<CreditMovement, "balanceAfter">): void {
    this._movements.push({ ...movement, balanceAfter: this._balance });
  }

  /** Movimientos pendientes de persistir, uno por cada `grant()`/`spend()`/`refund()` desde la última llamada. */
  pullMovements(): CreditMovement[] {
    const movements = this._movements;
    this._movements = [];
    return movements;
  }

  /* ─── Lectura ──────────────────────────────────────────────────────── */

  get schoolId(): SchoolId {
    return this.id;
  }

  get balance(): number {
    return this._balance;
  }

  get hardLimit(): boolean {
    return this._hardLimit;
  }
}
