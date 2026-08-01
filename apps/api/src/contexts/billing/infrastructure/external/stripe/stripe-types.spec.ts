import { describe, expect, it } from "vitest";
import {
  latestRefundOf,
  toReconciledAmount,
  type StripeChargeEvent,
  type StripePaymentIntent,
} from "./stripe-types.js";

describe("latestRefundOf", () => {
  /**
   * Las listas de Stripe vienen ordenadas de MÁS NUEVA a más vieja
   * (https://docs.stripe.com/api/pagination). El evento `charge.refunded`
   * trae el cargo entero con TODAS sus devoluciones, así que coger la última
   * de la lista devolvía la más antigua —ya reconciliada— y dejaba la
   * devolución que motivó el evento en `pending` para siempre.
   */
  it("devuelve la devolución más reciente, que es la primera de la lista", () => {
    const charge: StripeChargeEvent = {
      id: "ch_1",
      payment_intent: "pi_1",
      refunds: {
        data: [
          { id: "re_segunda", status: "succeeded" },
          { id: "re_primera", status: "succeeded" },
        ],
      },
    };

    expect(latestRefundOf(charge)).toEqual({ id: "re_segunda" });
  });

  it("con una sola devolución, esa misma", () => {
    const charge: StripeChargeEvent = {
      id: "ch_1",
      payment_intent: "pi_1",
      refunds: { data: [{ id: "re_unica", status: "succeeded" }] },
    };

    expect(latestRefundOf(charge)).toEqual({ id: "re_unica" });
  });

  it("sin devoluciones no hay nada que reconciliar", () => {
    expect(latestRefundOf({ id: "ch_1", payment_intent: "pi_1", refunds: { data: [] } })).toBeNull();
    expect(latestRefundOf({ id: "ch_1", payment_intent: "pi_1" })).toBeNull();
  });
});

describe("toReconciledAmount", () => {
  const base: StripePaymentIntent = { id: "pi_1", status: "succeeded" };

  it("prefiere lo cobrado de verdad (`amount_received`) a lo pedido (`amount`)", () => {
    expect(toReconciledAmount({ ...base, amount: 12_100, amount_received: 11_000, currency: "eur" })).toEqual({
      amountCents: 11_000,
      currency: "EUR",
    });
  });

  it("recurre a `amount` si el evento no trae `amount_received`", () => {
    expect(toReconciledAmount({ ...base, amount: 12_100, currency: "eur" })).toEqual({
      amountCents: 12_100,
      currency: "EUR",
    });
  });

  it("null si el evento no trae importe o moneda utilizables", () => {
    expect(toReconciledAmount(base)).toBeNull();
    expect(toReconciledAmount({ ...base, amount: 12_100 })).toBeNull();
    expect(toReconciledAmount({ ...base, amount: -1, currency: "eur" })).toBeNull();
  });
});
