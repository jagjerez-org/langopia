import type {
  ChargeOutcome,
  ChargeResult,
  PaymentStatus,
  RefundOutcome,
  RefundResult,
} from "../../../domain/ports/payment-gateway.port.js";
import { PaymentProvider } from "../../../domain/ports/payment-gateway.port.js";

/**
 * Formas crudas de la API REST de Stripe, tal cual llegan en el JSON.
 *
 * Todo el vocabulario que «solo se entiende leyendo la documentación de
 * Stripe» —`PaymentIntent`, `application_fee_amount`, `transfer_data`, sus
 * propios nombres de estado— vive en ESTE fichero y en el adaptador de al
 * lado. Nada de esto cruza hacia `domain/` ni `application/`
 * (`domain-purity.spec.ts`, paso 7b, lo comprueba solo).
 */

/** https://docs.stripe.com/api/payment_intents/object#payment_intent_object-status */
export type StripePaymentIntentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export type StripePaymentIntent = {
  id: string;
  status: StripePaymentIntentStatus;
  /** Lo pedido, en la unidad mínima de la moneda. */
  amount?: number;
  /** Lo efectivamente cobrado. Puede diferir de `amount`; manda este. */
  amount_received?: number;
  /** ISO-4217 en minúsculas, como lo manda Stripe. */
  currency?: string;
  last_payment_error?: { code?: string; message?: string } | null;
};

/** https://docs.stripe.com/api/refunds/object#refund_object-status */
export type StripeRefundStatus = "pending" | "requires_action" | "succeeded" | "failed" | "canceled";

export type StripeRefund = {
  id: string;
  status: StripeRefundStatus;
};

/** https://docs.stripe.com/api/accounts/object */
export type StripeAccount = { id: string };

/** https://docs.stripe.com/api/account_links/object */
export type StripeAccountLink = { url: string; expires_at: number };

/**
 * Solo los campos de la cuenta que decide si cobra o no. Stripe llama a este
 * evento `account.updated`; lo que traducimos es SOLO esto, no la cuenta
 * entera con sus decenas de campos de cumplimiento normativo.
 */
export type StripeAccountEvent = {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

/** Los campos de `charge.refunded` que hacen falta para reconciliar una devolución. */
export type StripeChargeEvent = {
  id: string;
  payment_intent: string | null;
  refunds?: { data: Array<{ id: string; status: StripeRefundStatus }> };
};

/** Sobre genérico de un evento de webhook: mismo `data.object` que trae cada tipo. */
export type StripeWebhookEvent<T = unknown> = {
  id: string;
  type: string;
  data: { object: T };
};

function toChargeOutcome(status: StripePaymentIntentStatus): ChargeOutcome {
  if (status === "succeeded") return "succeeded";
  if (status === "canceled") return "failed";
  // requires_payment_method / requires_confirmation / requires_action /
  // processing / requires_capture: nada de esto es definitivo todavía.
  return "pending";
}

export function toChargeResult(intent: StripePaymentIntent): ChargeResult {
  return {
    status: toChargeOutcome(intent.status),
    charge: { provider: PaymentProvider.Stripe, ref: intent.id },
    failureCode: intent.last_payment_error?.code ?? null,
    failureMessage: intent.last_payment_error?.message ?? null,
  };
}

function toRefundOutcome(status: StripeRefundStatus): RefundOutcome {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  return "pending";
}

export function toRefundResult(refund: StripeRefund): RefundResult {
  return {
    status: toRefundOutcome(refund.status),
    refund: { provider: PaymentProvider.Stripe, ref: refund.id },
  };
}

export function toPaymentStatus(intent: StripePaymentIntent): PaymentStatus {
  return toChargeOutcome(intent.status);
}

/**
 * `account.updated` traducido a NUESTRO vocabulario (paso 3 del brief): el
 * estado que guardamos es `active`/`restricted`, nunca el nombre que use
 * Stripe. Una cuenta cobra de verdad cuando puede cargar Y recibir pagos —
 * cualquier otra combinación se trata como restringida, aunque Stripe tenga
 * matices propios (`requirements`, `disabled_reason`) que aquí no hace falta
 * modelar: lo único que le importa a la escuela es si puede cobrar hoy.
 */
export function toMerchantStatus(account: StripeAccountEvent): "active" | "restricted" {
  return account.charges_enabled && account.payouts_enabled ? "active" : "restricted";
}

/**
 * La devolución más reciente de un `charge.refunded`. Stripe manda el cargo
 * ENTERO con la lista completa de sus devoluciones, no solo la nueva.
 *
 * Es la PRIMERA de la lista, no la última: las listas de Stripe vienen
 * ordenadas de más nueva a más vieja
 * (https://docs.stripe.com/api/pagination). Coger `data[data.length - 1]`
 * devolvía la devolución más ANTIGUA, que ya estaba reconciliada, y dejaba la
 * segunda devolución parcial en `pending` para siempre.
 */
export function latestRefundOf(charge: StripeChargeEvent): { id: string } | null {
  const refunds = charge.refunds?.data ?? [];
  const newest = refunds[0];
  return newest ? { id: newest.id } : null;
}

/**
 * El importe que dice el PROVEEDOR que se cobró, traducido a céntimos enteros
 * y moneda ISO-4217 en mayúsculas.
 *
 * Se prefiere `amount_received` a `amount`: el primero es lo que de verdad se
 * cobró, el segundo lo que se pidió cobrar. `null` si el evento no trae
 * importe utilizable — entonces manda lo que tuviéramos registrado, que es lo
 * único que hay.
 */
export function toReconciledAmount(
  intent: StripePaymentIntent,
): { amountCents: number; currency: string } | null {
  const cents = intent.amount_received ?? intent.amount ?? null;
  if (cents == null || !Number.isInteger(cents) || cents < 0) return null;
  if (!intent.currency) return null;
  return { amountCents: cents, currency: intent.currency.toUpperCase() };
}
