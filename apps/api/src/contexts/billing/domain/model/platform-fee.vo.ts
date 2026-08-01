import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { InvalidPlatformFeeError } from "../errors/billing.errors.js";
import { Money } from "./money.vo.js";

/**
 * La comisión de la plataforma sobre una factura `school_to_student`.
 *
 * Se calcula UNA VEZ, sobre el total en el momento de emitir, y el resultado
 * (`bps` + `cents`) es lo que `Invoice.issue()` congela. Nada aquí vuelve a
 * mirar la configuración de la escuela: si la comisión pactada cambia
 * mañana, este objeto ya construido no se entera, porque no guarda ninguna
 * referencia a la escuela — solo el resultado del cálculo.
 *
 * Con `bps = 0` o `enabled = false` el `bps` congelado es también cero, igual
 * que hace el seed (`applicationFee()` en `packages/db/src/seed/helpers.ts`):
 * una escuela sin comisión pactada y una escuela con comisión pactada pero
 * apagada dejan el mismo rastro en la factura, y es lo correcto — «cuánto se
 * cobró» es cero en los dos casos, no «pactado al 2% pero no aplicado esta
 * vez».
 */
export class PlatformFee extends ValueObject<{ bps: number; cents: number }> {
  private constructor(bps: number, cents: number) {
    super({ bps, cents });
  }

  static of(params: {
    /** El total sobre el que se calcula. */
    amount: Money;
    /** Puntos básicos: 250 = 2,50 %. */
    bps: number;
    /** Tope por operación, en céntimos. `null`/ausente = sin tope. */
    capCents?: number | null;
    /** Interruptor de la escuela. Por defecto activo. */
    enabled?: boolean;
  }): PlatformFee {
    const { amount, bps, capCents = null, enabled = true } = params;

    if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
      throw new InvalidPlatformFeeError(
        "los puntos básicos deben ser un entero entre 0 y 10000",
        { bps },
      );
    }
    if (capCents !== null && (!Number.isInteger(capCents) || capCents < 0)) {
      throw new InvalidPlatformFeeError("el tope debe ser un entero no negativo", { capCents });
    }

    const effectiveBps = enabled ? bps : 0;
    if (effectiveBps === 0) return new PlatformFee(0, 0);

    // Único punto de la clase con una división: el resultado se redondea al
    // céntimo antes de que salga de aquí, así que nunca circula un importe
    // fraccionario.
    const rawCents = Math.round((amount.cents * effectiveBps) / 10_000);
    const cents = capCents !== null ? Math.min(rawCents, capCents) : rawCents;
    return new PlatformFee(effectiveBps, cents);
  }

  /** La comisión nula. Es lo único que puede llevar una factura `platform_to_school`. */
  static zero(): PlatformFee {
    return new PlatformFee(0, 0);
  }

  /**
   * Construye una `PlatformFee` a partir de un `bps` y unos céntimos ya
   * calculados por otra vía — no por `bps % de amount`, sino, por ejemplo,
   * escalando proporcionalmente una comisión ya congelada
   * (`Invoice.proportionalFee()`, para un cobro o devolución parcial). El
   * tope por operación ya se aplicó cuando se calculó `cents`; recalcularlo
   * aquí contra el importe parcial daría un resultado distinto —y
   * equivocado— al de escalar la comisión ya fijada.
   */
  static exact(bps: number, cents: number): PlatformFee {
    if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
      throw new InvalidPlatformFeeError(
        "los puntos básicos deben ser un entero entre 0 y 10000",
        { bps },
      );
    }
    if (!Number.isInteger(cents) || cents < 0) {
      throw new InvalidPlatformFeeError("los céntimos deben ser un entero no negativo", {
        cents,
      });
    }
    return new PlatformFee(bps, cents);
  }

  get bps(): number {
    return this.props.bps;
  }

  get cents(): number {
    return this.props.cents;
  }

  toMoney(currency: string): Money {
    return Money.of(this.cents, currency);
  }
}
