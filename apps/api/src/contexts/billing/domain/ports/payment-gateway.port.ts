import type { Money } from "../model/money.vo.js";
import type { PlatformFee } from "../model/platform-fee.vo.js";

export const PAYMENT_GATEWAY = Symbol("PaymentGatewayPort");

/** Referencia a algo que vive en el proveedor. Nunca se interpreta aquí. */
export type ProviderRef = { provider: PaymentProvider; ref: string };

export const PaymentProvider = { Stripe: "stripe" } as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** A quién se cobra. Un correo basta: el proveedor decide si hace falta más. */
export type PayerRef = {
  email: string;
  /** Referencia del cliente en el proveedor, si ya existe una de un cobro anterior. */
  providerCustomerRef?: string | null;
};

/**
 * Resultado inmediato de un cobro.
 *
 * `pending` existe porque algunos medios de pago (SEPA, transferencia) no
 * confirman al instante: el estado definitivo llega después, por un webhook
 * que otro adaptador traduce a `record-payment` o a una reconciliación vía
 * `statusOf`. `succeeded`/`failed` sí son definitivos.
 */
export type ChargeOutcome = "succeeded" | "pending" | "failed";

export type ChargeResult = {
  status: ChargeOutcome;
  charge: ProviderRef;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export type RefundOutcome = "succeeded" | "pending" | "failed";

export type RefundResult = {
  status: RefundOutcome;
  refund: ProviderRef;
};

/** Estado de un cobro para reconciliar. Superconjunto de `ChargeOutcome`: aquí ya puede estar devuelto. */
export type PaymentStatus = ChargeOutcome | "refunded" | "partially_refunded";

export interface PaymentGatewayPort {
  /**
   * Cobra al alumno reteniendo la comisión de la plataforma.
   *
   * `fee` ya viene calculada y congelada por `Invoice`: el proveedor la
   * aplica, no la decide.
   */
  charge(params: {
    amount: Money;
    fee: PlatformFee;
    payer: PayerRef;
    merchant: ProviderRef;
    idempotencyKey: string;
  }): Promise<ChargeResult>;

  /** Devolución total o parcial. Revierte la parte proporcional de comisión. */
  refund(params: {
    charge: ProviderRef;
    amount: Money;
    reason: string;
    /** Si también se revierte comisión, y cuánta — ya calculada por `Invoice.refund()`. */
    feeReversed: Money;
    idempotencyKey: string;
  }): Promise<RefundResult>;

  /** Estado de un cobro, para reconciliar cuando el webhook no llegó. */
  statusOf(charge: ProviderRef): Promise<PaymentStatus>;
}
