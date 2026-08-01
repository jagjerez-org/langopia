import { describe, expect, it } from "vitest";
import { Money } from "./money.vo.js";
import { formatReceiptNumber, Receipt, ReceiptKind } from "./receipt.js";

const NOW = new Date("2026-07-27T10:00:00Z");

describe("formatReceiptNumber", () => {
  it("con la forma REC-YYYY-0001, independiente de la numeración de facturas", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("REC-2026-0001");
    expect(formatReceiptNumber(2026, 42)).toBe("REC-2026-0042");
  });

  it("un abono lleva su propio prefijo: no puede chocar con el número de un cobro", () => {
    // El fallo que cierra esta prueba: cobros y abonos compartían prefijo Y
    // contador, así que dos documentos distintos salían con el mismo número.
    expect(formatReceiptNumber(2026, 1, ReceiptKind.CreditNote)).toBe("ABN-2026-0001");
    expect(formatReceiptNumber(2026, 1, ReceiptKind.Payment)).not.toBe(
      formatReceiptNumber(2026, 1, ReceiptKind.CreditNote),
    );
  });
});

describe("Receipt.forPayment", () => {
  it("numera de forma correlativa: dos cobros consecutivos, dos números consecutivos", () => {
    const first = Receipt.forPayment({
      sequence: 1,
      year: 2026,
      invoiceId: "inv-1",
      paymentId: "pay-1",
      amount: Money.of(5_000, "EUR"),
      method: "card",
      issuedAt: NOW,
    });
    const second = Receipt.forPayment({
      sequence: 2,
      year: 2026,
      invoiceId: "inv-1",
      paymentId: "pay-2",
      amount: Money.of(7_100, "EUR"),
      method: "card",
      issuedAt: NOW,
    });

    expect(first.number).toBe("REC-2026-0001");
    expect(second.number).toBe("REC-2026-0002");
    expect(first.kind).toBe(ReceiptKind.Payment);
  });

  it("un cobro parcial genera un recibo por la parte cobrada, no por el total de la factura", () => {
    // La factura vale 12100; solo se han cobrado 5000 hasta ahora.
    const receipt = Receipt.forPayment({
      sequence: 1,
      year: 2026,
      invoiceId: "inv-1",
      paymentId: "pay-1",
      amount: Money.of(5_000, "EUR"),
      method: "card",
      issuedAt: NOW,
    });
    expect(receipt.amount.cents).toBe(5_000);
  });
});

describe("Receipt.forRefund", () => {
  it("una devolución no anula el recibo original: emite un abono aparte, con su propio número", () => {
    const original = Receipt.forPayment({
      sequence: 1,
      year: 2026,
      invoiceId: "inv-1",
      paymentId: "pay-1",
      amount: Money.of(12_100, "EUR"),
      method: "card",
      issuedAt: NOW,
    });

    const creditNote = Receipt.forRefund({
      sequence: 2,
      year: 2026,
      invoiceId: "inv-1",
      paymentId: "pay-1",
      amount: Money.of(6_050, "EUR"),
      reason: "goodwill",
      issuedAt: NOW,
    });

    // El original sigue existiendo, intacto: es el rastro de que el pago
    // ocurrió, y eso no se borra.
    expect(original.number).toBe("REC-2026-0001");
    expect(original.amount.cents).toBe(12_100);

    // El abono es un documento DISTINTO, con su propia serie de números.
    expect(creditNote.number).toBe("ABN-2026-0002");
    expect(creditNote.kind).toBe(ReceiptKind.CreditNote);
    expect(creditNote.amount.cents).toBe(6_050);
    expect(creditNote.reason).toBe("goodwill");
  });
});
