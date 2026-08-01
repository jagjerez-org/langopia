import { DomainError } from "../../../shared/domain/errors/domain-error.js";

/**
 * Un importe de `Money` no es válido: céntimos no enteros, negativos, o un
 * código de moneda que no es ISO-4217 de tres letras.
 *
 * Un solo código para las tres causas, igual que `InvalidTimeSlotError` en
 * `scheduling`: los `details` cambian de forma según la rama (a veces
 * `cents`, a veces `currency`), así que el mensaje traducido no interpola
 * nada — interpolar un marcador que a veces falta es peor que un mensaje fijo
 * (`messages.ts`, nota junto a `invalid_time_slot`).
 */
export class InvalidMoneyAmountError extends DomainError {
  readonly code = "invalid_money_amount";
  readonly kind = "invalid_input" as const;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(`Importe no válido: ${reason}.`, details);
  }
}

/** Sumar, restar o comparar dos `Money` de monedas distintas no tiene sentido. */
export class CurrencyMismatchError extends DomainError {
  readonly code = "currency_mismatch";
  readonly kind = "invalid_input" as const;

  constructor(a: string, b: string) {
    super(`No se puede operar entre «${a}» y «${b}»: son monedas distintas.`, { a, b });
  }
}

/** Los puntos básicos o el tope de una comisión de plataforma no son válidos. */
export class InvalidPlatformFeeError extends DomainError {
  readonly code = "invalid_platform_fee";
  readonly kind = "invalid_input" as const;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(`Comisión de plataforma no válida: ${reason}.`, details);
  }
}

/**
 * Una línea de factura con cantidad o precio unitario que no puede existir.
 * Se comprueba aquí, no en el DTO: una línea corrupta corrompe el total.
 */
export class InvalidInvoiceLineError extends DomainError {
  readonly code = "invalid_invoice_line";
  readonly kind = "invalid_input" as const;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(`Línea de factura no válida: ${reason}.`, details);
  }
}

/**
 * `issue()`, `markPaid()` o `refund()` se pidieron en un estado de la
 * factura que no lo admite.
 *
 * Sin parámetros en el mensaje traducido, igual que `SessionAlreadyClosedError`
 * en `scheduling`: los `details` viajan para quien consuma el error, no para
 * rellenar la plantilla.
 */
export class InvalidInvoiceStateError extends DomainError {
  readonly code = "invalid_invoice_state";
  readonly kind = "invariant_violation" as const;

  constructor(invoiceId: string, status: string, attempted: string) {
    super(`No se puede ${attempted} una factura en estado «${status}».`, {
      invoiceId,
      status,
      attempted,
    });
  }
}

/** `platform_to_school` es tu suscripción: nunca lleva comisión de plataforma. */
export class PlatformFeeNotAllowedError extends DomainError {
  readonly code = "platform_fee_not_allowed";
  readonly kind = "invariant_violation" as const;

  constructor(invoiceId: string) {
    super("Una factura de la plataforma a la escuela nunca lleva comisión.", { invoiceId });
  }
}

/** Un cobro no puede superar lo que queda pendiente de la factura. */
export class PaymentExceedsInvoiceTotalError extends DomainError {
  readonly code = "payment_exceeds_invoice_total";
  readonly kind = "invariant_violation" as const;

  constructor(invoiceId: string, amountCents: number, remainingCents: number) {
    super("El cobro registrado supera lo que queda pendiente de la factura.", {
      invoiceId,
      amountCents,
      remainingCents,
    });
  }
}

/** La regla del brief, literal: no se puede devolver más de lo cobrado. */
export class RefundExceedsPaymentError extends DomainError {
  readonly code = "refund_exceeds_payment";
  readonly kind = "invariant_violation" as const;

  constructor(invoiceId: string, amountCents: number, refundableCents: number) {
    super("No se puede devolver más de lo cobrado.", {
      invoiceId,
      amountCents,
      refundableCents,
    });
  }
}

/**
 * `CreditBalance.grant()`, `spend()` o `refund()` se pidieron con una
 * cantidad de créditos que no es un entero positivo.
 */
export class InvalidCreditAmountError extends DomainError {
  readonly code = "invalid_credit_amount";
  readonly kind = "invalid_input" as const;

  constructor(credits: number) {
    super("La cantidad de créditos debe ser un entero positivo.", { credits });
  }
}

/**
 * Tarea 5 de la ola 2, la regla que da título al brief: con `ai_hard_limit`
 * activado, un gasto que dejaría el saldo en negativo se rechaza entero. No
 * se genera «fiado» ni se cobra una parte.
 */
export class InsufficientCreditsError extends DomainError {
  readonly code = "insufficient_credits";
  readonly kind = "invariant_violation" as const;

  constructor(schoolId: string, requestedCredits: number, availableCredits: number) {
    super("No hay créditos suficientes para generar contenido con IA.", {
      schoolId,
      requestedCredits,
      availableCredits,
    });
  }
}
