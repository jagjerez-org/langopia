import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { InvoiceDirection } from "./invoice-direction.js";
import { InvoiceStatus } from "./invoice-status.js";
import { InvoiceId, StudentId } from "./identifiers.js";
import { Invoice } from "./invoice.aggregate.js";
import { Money } from "./money.vo.js";

const NOW = new Date("2026-07-27T09:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const STUDENT = StudentId.of("22222222-2222-4222-8222-222222222222");
const BILL_TO = MembershipId.of("33333333-3333-4333-8333-333333333333");

function oneLine(unitCents = 10_000) {
  return [
    {
      id: "44444444-4444-4444-8444-444444444444",
      description: "Curso de inglés — mensualidad",
      quantity: 1,
      unitCents,
      position: 1,
    },
  ];
}

function issueStudentInvoice(params: { bps?: number; capCents?: number | null; enabled?: boolean } = {}) {
  return Invoice.issue({
    id: InvoiceId.of("55555555-5555-4555-8555-555555555555"),
    schoolId: SCHOOL,
    direction: InvoiceDirection.SchoolToStudent,
    studentId: STUDENT,
    billToMembershipId: BILL_TO,
    currency: "EUR",
    locale: "es-ES",
    lines: oneLine(),
    taxRateBps: 2100,
    feeBps: params.bps ?? 200,
    feeCapCents: params.capCents ?? null,
    feeEnabled: params.enabled ?? true,
    number: "2026-0001",
    issuedOn: NOW,
    dueOn: new Date("2026-08-10T00:00:00Z"),
  });
}

describe("Invoice.issue", () => {
  it("calcula subtotal, IVA y total sobre las líneas", () => {
    const invoice = issueStudentInvoice();
    expect(invoice.subtotalCents).toBe(10_000);
    expect(invoice.taxCents).toBe(2_100); // 21% de 10000
    expect(invoice.totalCents).toBe(12_100);
  });

  it("congela la comisión pactada (2%) sobre el TOTAL con impuestos", () => {
    const invoice = issueStudentInvoice({ bps: 200 });
    // 2% de 12100 = 242
    expect(invoice.applicationFeeBps).toBe(200);
    expect(invoice.applicationFeeCents).toBe(242);
  });

  it("emite abierta y sin nada cobrado", () => {
    const invoice = issueStudentInvoice();
    expect(invoice.status).toBe(InvoiceStatus.Open);
    expect(invoice.amountPaidCents).toBe(0);
  });

  it("emite el evento InvoiceIssued", () => {
    const invoice = issueStudentInvoice();
    const events = invoice.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.eventName).toBe("billing.invoice.issued");
    expect(events[0]!.payload().applicationFeeCents).toBe(242);
  });

  it("una factura platform_to_school nunca lleva comisión", () => {
    const invoice = Invoice.issue({
      id: InvoiceId.of("66666666-6666-4666-8666-666666666666"),
      schoolId: SCHOOL,
      direction: InvoiceDirection.PlatformToSchool,
      currency: "EUR",
      locale: "es-ES",
      lines: oneLine(5_000),
      taxRateBps: 2100,
      feeBps: 0,
      number: "LGP-2026-0001",
      issuedOn: NOW,
      dueOn: NOW,
    });
    expect(invoice.applicationFeeBps).toBe(0);
    expect(invoice.applicationFeeCents).toBe(0);
  });

  it("rechaza una comisión no nula en una factura platform_to_school", () => {
    expect(() =>
      Invoice.issue({
        id: InvoiceId.of("66666666-6666-4666-8666-666666666666"),
        schoolId: SCHOOL,
        direction: InvoiceDirection.PlatformToSchool,
        currency: "EUR",
        locale: "es-ES",
        lines: oneLine(5_000),
        taxRateBps: 0,
        feeBps: 200,
        number: "LGP-2026-0001",
        issuedOn: NOW,
        dueOn: NOW,
      }),
    ).toThrow(/comisión/);
  });

  it("no se puede emitir sin líneas", () => {
    expect(() =>
      Invoice.issue({
        id: InvoiceId.of("77777777-7777-4777-8777-777777777777"),
        schoolId: SCHOOL,
        direction: InvoiceDirection.SchoolToStudent,
        studentId: STUDENT,
        currency: "EUR",
        locale: "es-ES",
        lines: [],
        taxRateBps: 0,
        feeBps: 0,
        number: "2026-0002",
        issuedOn: NOW,
        dueOn: NOW,
      }),
    ).toThrow();
  });

  it("la comisión CONGELADA no cambia si la escuela cambia luego su application_fee_bps", () => {
    // La factura se emitió con la comisión vigente en ese momento (2%).
    const invoice = issueStudentInvoice({ bps: 200 });
    expect(invoice.applicationFeeBps).toBe(200);
    expect(invoice.applicationFeeCents).toBe(242);

    // La escuela sube su comisión al 5% DESPUÉS de emitir la factura. Nada
    // en `Invoice` vuelve a consultar la escuela ni recibe un `bps` nuevo:
    // no hay ningún método que recalcule, así que el cambio no puede
    // alcanzar a esta factura ya emitida.

    // El histórico no se movió un céntimo.
    expect(invoice.applicationFeeBps).toBe(200);
    expect(invoice.applicationFeeCents).toBe(242);

    // Una factura NUEVA, emitida después del cambio, sí usa la comisión
    // vigente (500 bps) — la congelación es por factura, no una constante
    // global: lo que no cambia es el HISTÓRICO, no la configuración futura.
    const facturaNueva = Invoice.issue({
      id: InvoiceId.of("88888888-8888-4888-8888-888888888888"),
      schoolId: SCHOOL,
      direction: InvoiceDirection.SchoolToStudent,
      studentId: STUDENT,
      currency: "EUR",
      locale: "es-ES",
      lines: oneLine(),
      taxRateBps: 2100,
      feeBps: 500,
      number: "2026-0003",
      issuedOn: NOW,
      dueOn: NOW,
    });
    expect(facturaNueva.applicationFeeBps).toBe(500);
    expect(facturaNueva.applicationFeeCents).toBe(605); // 5% de 12100

    // Y la factura original, releída, sigue sin moverse.
    expect(invoice.applicationFeeBps).toBe(200);
    expect(invoice.applicationFeeCents).toBe(242);
  });
});

describe("Invoice.remainingBalance", () => {
  it("antes de cualquier cobro, es el total", () => {
    const invoice = issueStudentInvoice();
    expect(invoice.remainingBalance.cents).toBe(invoice.totalCents);
  });

  it("tras un cobro parcial, descuenta lo ya cobrado", () => {
    const invoice = issueStudentInvoice();
    invoice.markPaid({ amount: Money.of(5_000, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    expect(invoice.remainingBalance.cents).toBe(invoice.totalCents - 5_000);
  });

  it("tras cubrir el total, es cero", () => {
    const invoice = issueStudentInvoice();
    invoice.markPaid({ amount: Money.of(invoice.totalCents, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    expect(invoice.remainingBalance.cents).toBe(0);
  });
});

describe("Invoice.markPaid", () => {
  it("un cobro que cubre el total marca la factura como pagada", () => {
    const invoice = issueStudentInvoice();
    invoice.pullDomainEvents();
    invoice.markPaid({
      amount: Money.of(invoice.totalCents, "EUR"),
      method: "card",
      providerRef: "pi_test_1",
      now: NOW,
    });
    expect(invoice.status).toBe(InvoiceStatus.Paid);
    expect(invoice.amountPaidCents).toBe(invoice.totalCents);
    expect(invoice.paidAt).toEqual(NOW);
  });

  it("un cobro parcial deja la factura abierta", () => {
    const invoice = issueStudentInvoice();
    invoice.markPaid({ amount: Money.of(5_000, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    expect(invoice.status).toBe(InvoiceStatus.Open);
    expect(invoice.amountPaidCents).toBe(5_000);
  });

  it("dos cobros parciales que suman el total completan la factura", () => {
    const invoice = issueStudentInvoice();
    invoice.markPaid({ amount: Money.of(5_000, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    invoice.markPaid({
      amount: Money.of(invoice.totalCents - 5_000, "EUR"),
      method: "card",
      providerRef: "pi_2",
      now: NOW,
    });
    expect(invoice.status).toBe(InvoiceStatus.Paid);
  });

  it("no se puede cobrar más de lo que queda pendiente", () => {
    const invoice = issueStudentInvoice();
    expect(() =>
      invoice.markPaid({
        amount: Money.of(invoice.totalCents + 1, "EUR"),
        method: "card",
        providerRef: "pi_1",
        now: NOW,
      }),
    ).toThrow(/pendiente/);
  });

  it("no se puede cobrar una factura ya pagada", () => {
    const invoice = issueStudentInvoice();
    invoice.markPaid({ amount: Money.of(invoice.totalCents, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    expect(() =>
      invoice.markPaid({ amount: Money.of(1, "EUR"), method: "card", providerRef: "pi_2", now: NOW }),
    ).toThrow(/estado/);
  });

  it("emite InvoicePaymentRecorded con el estado resultante", () => {
    const invoice = issueStudentInvoice();
    invoice.pullDomainEvents();
    invoice.markPaid({ amount: Money.of(5_000, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    const event = invoice.pullDomainEvents()[0]!;
    expect(event.eventName).toBe("billing.invoice.payment_recorded");
    expect(event.payload().resultingStatus).toBe(InvoiceStatus.Open);
  });
});

describe("Invoice.recordPaymentFailure", () => {
  it("emite PaymentFailed sin cambiar el estado ni lo cobrado (tarea 12: aviso de cobro fallido)", () => {
    const invoice = issueStudentInvoice();
    invoice.pullDomainEvents();

    invoice.recordPaymentFailure({
      amountCents: invoice.totalCents,
      failureCode: "card_declined",
      failureMessage: "La tarjeta fue rechazada.",
    });

    expect(invoice.status).toBe(InvoiceStatus.Open);
    expect(invoice.amountPaidCents).toBe(0);

    const event = invoice.pullDomainEvents()[0]!;
    expect(event.eventName).toBe("billing.payment.failed");
    expect(event.payload()).toEqual({
      invoiceId: invoice.id.value,
      amountCents: invoice.totalCents,
      currency: "EUR",
      failureCode: "card_declined",
      failureMessage: "La tarjeta fue rechazada.",
    });
  });
});

describe("Invoice.grossAmountForSession", () => {
  const SESSION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  function invoiceWithSessionLine(taxRateBps: number) {
    return Invoice.issue({
      id: InvoiceId.of("55555555-5555-4555-8555-555555555555"),
      schoolId: SCHOOL,
      direction: InvoiceDirection.SchoolToStudent,
      studentId: STUDENT,
      currency: "EUR",
      locale: "es-ES",
      lines: [
        { id: "44444444-4444-4444-8444-444444444444", description: "Mensualidad", quantity: 1, unitCents: 5_000 },
        {
          id: "44444444-4444-4444-8444-444444444445",
          description: "Clase suelta",
          quantity: 1,
          unitCents: 10_000,
          sessionId: SESSION,
        },
      ],
      taxRateBps,
      feeBps: 200,
      number: "2026-0004",
      issuedOn: NOW,
      dueOn: NOW,
    });
  }

  it("devuelve la línea de la sesión CON impuestos: es lo que se cobró de verdad", () => {
    // Clase de 100 € con un 21 % de IVA: quien paga desembolsó 121 €. Devolver
    // los 100 de `invoice_lines.total_cents` sería quedarse con el IVA de un
    // servicio que no se prestó.
    const invoice = invoiceWithSessionLine(2100);
    expect(invoice.grossAmountForSession(SESSION)!.cents).toBe(12_100);
  });

  it("sin impuestos coincide con el importe de la línea", () => {
    const invoice = invoiceWithSessionLine(0);
    expect(invoice.grossAmountForSession(SESSION)!.cents).toBe(10_000);
  });

  it("el reparto de todas las líneas suma exactamente el total de la factura", () => {
    const invoice = invoiceWithSessionLine(2100);
    // 5000 + 10000 = 15000 de subtotal, 3150 de IVA, 18150 de total.
    expect(invoice.totalCents).toBe(18_150);
    const sessionPart = invoice.grossAmountForSession(SESSION)!.cents;
    expect(invoice.totalCents - sessionPart).toBe(6_050); // la mensualidad, con su IVA
  });

  it("es null si la factura no tiene ninguna línea de esa sesión", () => {
    const invoice = invoiceWithSessionLine(2100);
    expect(invoice.grossAmountForSession("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBeNull();
  });
});

describe("Invoice.proportionalFee (reparto de la comisión congelada)", () => {
  /** Total 1000 exactos, comisión del 2,5 % = 25. Sin IVA de por medio. */
  function feeInvoice() {
    return Invoice.issue({
      id: InvoiceId.of("55555555-5555-4555-8555-555555555555"),
      schoolId: SCHOOL,
      direction: InvoiceDirection.SchoolToStudent,
      studentId: STUDENT,
      currency: "EUR",
      locale: "es-ES",
      lines: oneLine(1_000),
      taxRateBps: 0,
      feeBps: 250,
      number: "2026-0005",
      issuedOn: NOW,
      dueOn: NOW,
    });
  }

  function payAndCollectFees(invoice: Invoice, parts: number[]): number[] {
    return parts.map((part) => {
      const amount = Money.of(part, "EUR");
      const fee = invoice.proportionalFee(amount).cents;
      invoice.markPaid({ amount, method: "card", providerRef: `pi_${part}`, now: NOW });
      return fee;
    });
  }

  it("dos cobros de la mitad no inventan un céntimo de comisión", () => {
    // El fallo que cierra esta prueba: `round(25 * 500 / 1000)` daba 13 en
    // cada mitad y se cobraban 26 céntimos de una comisión congelada de 25.
    const invoice = feeInvoice();
    expect(invoice.applicationFeeCents).toBe(25);

    const fees = payAndCollectFees(invoice, [500, 500]);

    expect(fees.reduce((a, b) => a + b, 0)).toBe(25);
  });

  it("tres cobros desiguales no pierden ningún céntimo de comisión", () => {
    // Y al revés: 333/333/334 daban 8+8+8 = 24, un céntimo perdido.
    const invoice = feeInvoice();

    const fees = payAndCollectFees(invoice, [333, 333, 334]);

    expect(fees.reduce((a, b) => a + b, 0)).toBe(25);
  });

  it("un cobro único por el total lleva la comisión entera", () => {
    const invoice = feeInvoice();
    expect(invoice.proportionalFee(Money.of(1_000, "EUR")).cents).toBe(25);
  });

  it("devolver a trozos revierte exactamente la comisión congelada", () => {
    const invoice = feeInvoice();
    invoice.markPaid({ amount: Money.of(1_000, "EUR"), method: "card", providerRef: "pi_1", now: NOW });

    const first = invoice.refund({ amount: Money.of(500, "EUR"), reason: "goodwill", now: NOW });
    const second = invoice.refund({ amount: Money.of(500, "EUR"), reason: "goodwill", now: NOW });

    expect(first.feeReversedCents + second.feeReversedCents).toBe(25);
  });
});

describe("Invoice.refund", () => {
  function paidInvoice() {
    const invoice = issueStudentInvoice({ bps: 200 }); // total 12100, fee 242
    invoice.markPaid({ amount: Money.of(invoice.totalCents, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
    invoice.pullDomainEvents();
    return invoice;
  }

  /**
   * Una factura cobrada tal y como la reconstruye el repositorio, con los
   * contadores que este deriva de `payments`/`refunds` — incluidas las
   * devoluciones pedidas y todavía sin confirmar.
   */
  function rehydratedPaidInvoice(params: { refundedCents: number; refundPendingCents: number }) {
    const issued = paidInvoice();
    return Invoice.rehydrate({
      id: issued.id,
      schoolId: issued.schoolId,
      direction: issued.direction,
      studentId: issued.studentId,
      billToMembershipId: issued.billToMembershipId,
      number: issued.number,
      status: issued.status,
      currency: issued.currency,
      locale: issued.locale,
      lines: [...issued.lines],
      taxRateBps: issued.taxRateBps,
      subtotalCents: issued.subtotalCents,
      taxCents: issued.taxCents,
      totalCents: issued.totalCents,
      applicationFeeBps: issued.applicationFeeBps,
      applicationFeeCents: issued.applicationFeeCents,
      issuedOn: issued.issuedOn,
      dueOn: issued.dueOn,
      paidAt: issued.paidAt,
      amountPaidCents: issued.amountPaidCents,
      amountRefundedCents: params.refundedCents,
      amountRefundPendingCents: params.refundPendingCents,
    });
  }

  it("una devolución total revierte toda la comisión", () => {
    const invoice = paidInvoice();
    const { feeReversedCents } = invoice.refund({
      amount: Money.of(invoice.totalCents, "EUR"),
      reason: "service_not_provided",
      now: NOW,
    });
    expect(feeReversedCents).toBe(242);
    expect(invoice.amountRefundedCents).toBe(invoice.totalCents);
  });

  it("una devolución parcial revierte la parte proporcional de comisión", () => {
    const invoice = paidInvoice(); // total 12100, fee 242
    // Se devuelve la mitad exacta.
    const { feeReversedCents } = invoice.refund({
      amount: Money.of(6_050, "EUR"),
      reason: "goodwill",
      now: NOW,
    });
    expect(feeReversedCents).toBe(121); // la mitad de 242
  });

  it("no se puede devolver más de lo cobrado", () => {
    const invoice = paidInvoice();
    expect(() =>
      invoice.refund({
        amount: Money.of(invoice.totalCents + 1, "EUR"),
        reason: "requested_by_customer",
        now: NOW,
      }),
    ).toThrow(/cobrado/);
  });

  it("no se puede devolver dos veces más de lo cobrado entre ambas devoluciones", () => {
    const invoice = paidInvoice();
    invoice.refund({ amount: Money.of(8_000, "EUR"), reason: "goodwill", now: NOW });
    expect(() =>
      invoice.refund({ amount: Money.of(invoice.totalCents - 8_000 + 1, "EUR"), reason: "goodwill", now: NOW }),
    ).toThrow(/cobrado/);
  });

  it("emite InvoiceRefunded con la comisión revertida", () => {
    const invoice = paidInvoice();
    invoice.refund({ amount: Money.of(invoice.totalCents, "EUR"), reason: "duplicate", now: NOW });
    const event = invoice.pullDomainEvents()[0]!;
    expect(event.eventName).toBe("billing.invoice.refunded");
    expect(event.payload().feeReversedCents).toBe(242);
  });

  it("una devolución PEDIDA y sin confirmar ya cuenta contra el tope", () => {
    // El fallo que cierra esta prueba: una devolución `pending` no contaba, y
    // se podían emitir DOS devoluciones por el importe total del mismo cobro.
    const invoice = rehydratedPaidInvoice({ refundedCents: 0, refundPendingCents: 12_100 });

    expect(invoice.refundableBalance.cents).toBe(0);
    expect(() => invoice.assertCanBeRefunded(Money.of(12_100, "EUR"))).toThrow(/cobrado/);
    expect(() => invoice.assertCanBeRefunded(Money.of(1, "EUR"))).toThrow(/cobrado/);
  });

  it("con una devolución pendiente parcial, solo queda devolvible el resto", () => {
    const invoice = rehydratedPaidInvoice({ refundedCents: 0, refundPendingCents: 5_000 });

    expect(invoice.refundableBalance.cents).toBe(7_100);
    expect(() => invoice.assertCanBeRefunded(Money.of(7_100, "EUR"))).not.toThrow();
    expect(() => invoice.assertCanBeRefunded(Money.of(7_101, "EUR"))).toThrow(/cobrado/);
  });

  it("confirmar una devolución pendiente no la cuenta dos veces", () => {
    // Es lo que hace la reconciliación por webhook: la fila ya está `pending`
    // cuando llega la confirmación. Si el tope la descontara otra vez, una
    // devolución legítima rechazaría su propia confirmación.
    const invoice = rehydratedPaidInvoice({ refundedCents: 0, refundPendingCents: 12_100 });

    const { feeReversedCents } = invoice.refund({
      amount: Money.of(12_100, "EUR"),
      reason: "service_not_provided",
      now: NOW,
    });

    expect(feeReversedCents).toBe(242);
    expect(invoice.amountRefundedCents).toBe(12_100);
    expect(invoice.amountRefundPendingCents).toBe(0);
  });

  it("una factura sin comisión (platform_to_school) nunca revierte comisión", () => {
    const invoice = Invoice.issue({
      id: InvoiceId.of("99999999-9999-4999-8999-999999999999"),
      schoolId: SCHOOL,
      direction: InvoiceDirection.PlatformToSchool,
      currency: "EUR",
      locale: "es-ES",
      lines: oneLine(5_000),
      taxRateBps: 0,
      feeBps: 0,
      number: "LGP-2026-0002",
      issuedOn: NOW,
      dueOn: NOW,
    });
    invoice.markPaid({ amount: Money.of(5_000, "EUR"), method: "bank_transfer", providerRef: "in_1", now: NOW });
    const { feeReversedCents } = invoice.refund({ amount: Money.of(5_000, "EUR"), reason: "goodwill", now: NOW });
    expect(feeReversedCents).toBe(0);
  });
});
