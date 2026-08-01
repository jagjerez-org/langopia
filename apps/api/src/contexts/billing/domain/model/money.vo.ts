import { ValueObject } from "../../../shared/domain/primitives/value-object.js";
import { CurrencyMismatchError, InvalidMoneyAmountError } from "../errors/billing.errors.js";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Un importe de dinero: céntimos enteros y su moneda.
 *
 * Nunca coma flotante. `1000` son 10,00 €, no `10.00`: la única aritmética
 * que existe en todo el módulo de facturación es sobre enteros, y el único
 * sitio donde una división puede aparecer (`PlatformFee.of`) redondea al
 * céntimo antes de que el resultado salga de esa función.
 *
 * Siempre no negativo. No representa un delta con signo — para eso está la
 * dirección de la operación (cobro vs. devolución), no el signo del importe.
 */
export class Money extends ValueObject<{ cents: number; currency: string }> {
  private constructor(cents: number, currency: string) {
    super({ cents, currency });
  }

  static of(cents: number, currency: string): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyAmountError("los céntimos deben ser un número entero", { cents });
    }
    if (cents < 0) {
      throw new InvalidMoneyAmountError("el importe no puede ser negativo", { cents });
    }
    const normalized = currency.toUpperCase();
    if (!CURRENCY_PATTERN.test(normalized)) {
      throw new InvalidMoneyAmountError(
        "la moneda debe ser un código ISO-4217 de tres letras",
        { currency },
      );
    }
    return new Money(cents, normalized);
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  get cents(): number {
    return this.props.cents;
  }

  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.cents + other.cents, this.currency);
  }

  /** Lanza `invalid_money_amount` si el resultado sería negativo. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.cents - other.cents, this.currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents > other.cents;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents >= other.cents;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
