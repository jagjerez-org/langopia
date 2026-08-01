import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { InvoiceDirection } from "../../../domain/model/invoice-direction.js";
import { InvoiceId, StudentId } from "../../../domain/model/identifiers.js";
import { Invoice } from "../../../domain/model/invoice.aggregate.js";
import { Money } from "../../../domain/model/money.vo.js";
import type {
  InvoiceRepository,
  PaidSessionCharge,
} from "../../../domain/ports/invoice.repository.port.js";
import { PaymentProvider, type PaymentGatewayPort } from "../../../domain/ports/payment-gateway.port.js";
import { RefundPaymentCommand } from "./refund-payment.command.js";
import { RefundPaymentHandler } from "./refund-payment.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const STUDENT = StudentId.of("22222222-2222-4222-8222-222222222222");
const INVOICE_ID = InvoiceId.of("55555555-5555-4555-8555-555555555555");

/**
 * Fábrica, no un valor fijo: el manejador relee la factura del repositorio
 * más de una vez (antes y después de llamar al proveedor de pago), y un
 * repositorio de verdad devuelve cada vez una instancia recién reconstruida
 * desde la fila, no la misma referencia mutada por la lectura anterior. Un
 * doble que devolviera siempre el mismo objeto escondería justo el tipo de
 * error de estado compartido que separar ambas fases pretende evitar.
 */
function buildPaidInvoice(): Invoice {
  const invoice = Invoice.issue({
    id: INVOICE_ID,
    schoolId: SCHOOL,
    direction: InvoiceDirection.SchoolToStudent,
    studentId: STUDENT,
    currency: "EUR",
    locale: "es-ES",
    lines: [
      { id: "66666666-6666-4666-8666-666666666666", description: "Curso", quantity: 1, unitCents: 10_000 },
    ],
    taxRateBps: 2100, // total 12100
    feeBps: 200, // fee 242
    number: "2026-0001",
    issuedOn: NOW,
    dueOn: NOW,
  });
  invoice.markPaid({ amount: Money.of(12_100, "EUR"), method: "card", providerRef: "pi_1", now: NOW });
  invoice.pullDomainEvents();
  return invoice;
}

/**
 * Reconstruye una instancia INDEPENDIENTE a partir del estado público de
 * otra, exactamente lo que hace un mapper de verdad al releer una fila.
 * Necesario porque `Invoice.refund()` muta en sitio: si el doble devolviera
 * siempre la misma referencia, la llamada de validación de la fase de
 * lectura (que nunca se guarda) contaminaría la fase de escritura, y el
 * doble estaría escondiendo el motivo por el que ambas fases releen en vez
 * de compartir el objeto.
 */
function cloneOf(invoice: Invoice): Invoice {
  return Invoice.rehydrate({
    id: invoice.id,
    schoolId: invoice.schoolId,
    direction: invoice.direction,
    studentId: invoice.studentId,
    billToMembershipId: invoice.billToMembershipId,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    locale: invoice.locale,
    lines: [...invoice.lines],
    taxRateBps: invoice.taxRateBps,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    applicationFeeBps: invoice.applicationFeeBps,
    applicationFeeCents: invoice.applicationFeeCents,
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
    paidAt: invoice.paidAt,
    amountPaidCents: invoice.amountPaidCents,
    amountRefundedCents: invoice.amountRefundedCents,
    amountRefundPendingCents: invoice.amountRefundPendingCents,
  });
}

/**
 * La misma factura cobrada, pero con una devolución YA PEDIDA al proveedor y
 * sin confirmar todavía — tal y como la reconstruye el repositorio sumando
 * las filas `pending` de `refunds`.
 */
function buildPaidInvoiceWithPendingRefund(pendingCents: number): () => Invoice {
  return () => {
    const paid = buildPaidInvoice();
    return Invoice.rehydrate({
      id: paid.id,
      schoolId: paid.schoolId,
      direction: paid.direction,
      studentId: paid.studentId,
      billToMembershipId: paid.billToMembershipId,
      number: paid.number,
      status: paid.status,
      currency: paid.currency,
      locale: paid.locale,
      lines: [...paid.lines],
      taxRateBps: paid.taxRateBps,
      subtotalCents: paid.subtotalCents,
      taxCents: paid.taxCents,
      totalCents: paid.totalCents,
      applicationFeeBps: paid.applicationFeeBps,
      applicationFeeCents: paid.applicationFeeCents,
      issuedOn: paid.issuedOn,
      dueOn: paid.dueOn,
      paidAt: paid.paidAt,
      amountPaidCents: paid.amountPaidCents,
      amountRefundedCents: 0,
      amountRefundPendingCents: pendingCents,
    });
  };
}

function fakeInvoiceRepository(
  buildInvoice: () => Invoice,
  paymentLookup: { paymentId: string; charge: { provider: "stripe"; ref: string } } | null,
): InvoiceRepository & {
  refundsRecorded: unknown[];
  savedInvoices: Invoice[];
  receiptSequenceCalls: unknown[];
} {
  const refundsRecorded: unknown[] = [];
  const receiptSequenceCalls: unknown[] = [];
  // Simula la persistencia: cada `findOrFail()` reconstruye desde el último
  // estado guardado, igual que un `SELECT` tras un `UPDATE` en Postgres.
  let persisted = buildInvoice();
  const savedInvoices: Invoice[] = [];
  return {
    refundsRecorded,
    savedInvoices,
    receiptSequenceCalls,
    find: async () => cloneOf(persisted),
    findOrFail: async () => cloneOf(persisted),
    save: async (invoice) => {
      persisted = invoice;
      savedInvoices.push(invoice);
    },
    nextInvoiceNumber: async () => 1,
    nextReceiptSequence: async (params) => {
      receiptSequenceCalls.push(params);
      return 5;
    },
    recordPayment: async () => ({ paymentId: "pay-1" }),
    recordRefund: async (params) => {
      refundsRecorded.push(params);
      return { refundId: "refund-1" };
    },
    findPaidChargesForSession: async (): Promise<PaidSessionCharge[]> => [],
    findLatestSucceededPayment: async () => paymentLookup,
    findPaymentByProviderRef: async () => null,
    markPaymentSucceeded: async () => undefined,
    findRefundByProviderRef: async () => null,
    markRefundSucceeded: async () => undefined,
  };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

/** Ver el gemelo en `record-payment.handler.spec.ts`: la enésima escritura se deshace. */
function fakeUowFailingWriteNumber(failing: number): UnitOfWork {
  let writes = 0;
  return {
    read: (work) => work(),
    execute: async (work) => {
      writes += 1;
      if (writes === failing) throw new Error("la transacción se deshizo");
      return work();
    },
  };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

const REQUESTER = "44444444-4444-4444-8444-444444444444";

function fakeTenant(): TenantContext {
  return {
    schoolId: () => SCHOOL.value,
    membershipId: () => REQUESTER,
    roles: () => ["owner"],
    has: () => true,
  };
}

function fakeGateway(status: "succeeded" | "pending" | "failed" = "succeeded"): PaymentGatewayPort & {
  refundCalls: unknown[];
} {
  const refundCalls: unknown[] = [];
  return {
    charge: vi.fn(),
    refund: async (params) => {
      refundCalls.push(params);
      return { status, refund: { provider: PaymentProvider.Stripe, ref: "re_test_1" } };
    },
    statusOf: vi.fn(),
    refundCalls,
  };
}

const PAYMENT_LOOKUP = {
  paymentId: "pay-1",
  charge: { provider: PaymentProvider.Stripe, ref: "pi_1" } as const,
};

describe("RefundPaymentHandler (paso 9b: doble del puerto, sin red)", () => {
  it("una devolución total revierte toda la comisión y emite un abono", async () => {
    const invoices = fakeInvoiceRepository(buildPaidInvoice, PAYMENT_LOOKUP);
    const gateway = fakeGateway("succeeded");

    const handler = new RefundPaymentHandler(invoices, gateway, fakeUow(), fakeEvents(), fakeClock(), fakeTenant(), fakeLogger());
    const result = await handler.execute(
      new RefundPaymentCommand({
        invoiceId: INVOICE_ID.value,
        amountCents: 12_100,
        reason: "service_not_provided",
        idempotencyKey: "idem-refund-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.feeReversedCents).toBe(242);
    // Un abono, no un recibo de cobro: serie propia, prefijo propio.
    expect(result.receiptNumber).toBe("ABN-2026-0005");
    expect(invoices.receiptSequenceCalls[0]).toMatchObject({ kind: "credit_note", year: 2026 });
    expect(invoices.savedInvoices.at(-1)!.amountRefundedCents).toBe(12_100);
  });

  it("una devolución parcial revierte la parte proporcional de comisión", async () => {
    const invoices = fakeInvoiceRepository(buildPaidInvoice, PAYMENT_LOOKUP);
    const gateway = fakeGateway("succeeded");

    const handler = new RefundPaymentHandler(invoices, gateway, fakeUow(), fakeEvents(), fakeClock(), fakeTenant(), fakeLogger());
    const result = await handler.execute(
      new RefundPaymentCommand({
        invoiceId: INVOICE_ID.value,
        amountCents: 6_050, // la mitad
        reason: "goodwill",
        idempotencyKey: "idem-refund-2",
      }),
    );

    expect(result.feeReversedCents).toBe(121); // la mitad de 242
  });

  it("no se puede devolver más de lo cobrado: ni siquiera llama al proveedor de pago", async () => {
    const invoices = fakeInvoiceRepository(buildPaidInvoice, PAYMENT_LOOKUP);
    const gateway = fakeGateway("succeeded");

    const handler = new RefundPaymentHandler(invoices, gateway, fakeUow(), fakeEvents(), fakeClock(), fakeTenant(), fakeLogger());

    await expect(
      handler.execute(
        new RefundPaymentCommand({
          invoiceId: INVOICE_ID.value,
          amountCents: 12_101,
          reason: "goodwill",
          idempotencyKey: "idem-refund-3",
        }),
      ),
    ).rejects.toThrow(/cobrado/);

    expect(gateway.refundCalls).toHaveLength(0);
  });

  it("una devolución PENDIENTE bloquea otra por el mismo importe: ni siquiera llama al proveedor", async () => {
    // El fallo que cierra esta prueba: la primera devolución se quedaba
    // `pending`, no contaba contra el tope, y la segunda pasaba — dos
    // devoluciones por el importe total del mismo cobro.
    const invoices = fakeInvoiceRepository(buildPaidInvoiceWithPendingRefund(12_100), PAYMENT_LOOKUP);
    const gateway = fakeGateway("succeeded");

    const handler = new RefundPaymentHandler(invoices, gateway, fakeUow(), fakeEvents(), fakeClock(), fakeTenant(), fakeLogger());

    await expect(
      handler.execute(
        new RefundPaymentCommand({
          invoiceId: INVOICE_ID.value,
          amountCents: 12_100,
          reason: "goodwill",
          idempotencyKey: "idem-refund-6",
        }),
      ),
    ).rejects.toThrow(/cobrado/);

    expect(gateway.refundCalls).toHaveLength(0);
    expect(invoices.refundsRecorded).toHaveLength(0);
  });

  it("una devolución con éxito cuya transacción revienta deja rastro pendiente de reconciliar", async () => {
    const invoices = fakeInvoiceRepository(buildPaidInvoice, PAYMENT_LOOKUP);
    const gateway = fakeGateway("succeeded");

    const handler = new RefundPaymentHandler(
      invoices,
      gateway,
      // La primera escritura —la que cierra la devolución— se deshace entera.
      fakeUowFailingWriteNumber(1),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeLogger(),
    );

    await expect(
      handler.execute(
        new RefundPaymentCommand({
          invoiceId: INVOICE_ID.value,
          amountCents: 12_100,
          reason: "goodwill",
          idempotencyKey: "idem-refund-5",
        }),
      ),
    ).rejects.toThrow(/deshizo/);

    // El proveedor devolvió el dinero de verdad: sin esta fila, ese dinero
    // sale de la cuenta de la escuela sin que nada lo cuente.
    expect(gateway.refundCalls).toHaveLength(1);
    expect(invoices.refundsRecorded).toHaveLength(1);
    expect(invoices.refundsRecorded[0]).toMatchObject({
      status: "pending",
      amountCents: 12_100,
      applicationFeeReversedCents: 0,
      refund: { provider: PaymentProvider.Stripe, ref: "re_test_1" },
    });
  });

  it("sin ningún cobro con éxito no hay nada que devolver", async () => {
    const invoices = fakeInvoiceRepository(buildPaidInvoice, null);
    const gateway = fakeGateway("succeeded");

    const handler = new RefundPaymentHandler(invoices, gateway, fakeUow(), fakeEvents(), fakeClock(), fakeTenant(), fakeLogger());

    await expect(
      handler.execute(
        new RefundPaymentCommand({
          invoiceId: INVOICE_ID.value,
          amountCents: 1_000,
          reason: "goodwill",
          idempotencyKey: "idem-refund-4",
        }),
      ),
    ).rejects.toThrow();
  });
});
