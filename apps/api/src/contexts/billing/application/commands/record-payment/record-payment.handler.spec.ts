import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
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
import {
  PaymentProvider,
  type ChargeResult,
  type PaymentGatewayPort,
} from "../../../domain/ports/payment-gateway.port.js";
import type { SchoolBillingPolicyPort } from "../../../domain/ports/school-billing-policy.port.js";
import { RecordPaymentCommand } from "./record-payment.command.js";
import { RecordPaymentHandler } from "./record-payment.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const STUDENT = StudentId.of("22222222-2222-4222-8222-222222222222");
const INVOICE_ID = InvoiceId.of("55555555-5555-4555-8555-555555555555");

function freshInvoice(): Invoice {
  return Invoice.issue({
    id: INVOICE_ID,
    schoolId: SCHOOL,
    direction: InvoiceDirection.SchoolToStudent,
    studentId: STUDENT,
    currency: "EUR",
    locale: "es-ES",
    lines: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        description: "Curso de inglés",
        quantity: 1,
        unitCents: 10_000,
      },
    ],
    taxRateBps: 2100, // total 12100
    feeBps: 200, // fee 242
    number: "2026-0001",
    issuedOn: NOW,
    dueOn: NOW,
  });
}

/** Doble en memoria: el mismo tipo de sustitución que usa `PurgeExpiredRecordingsJob.spec.ts`. */
function fakeInvoiceRepository(invoice: Invoice): InvoiceRepository & { paymentsRecorded: unknown[] } {
  const paymentsRecorded: unknown[] = [];
  let paymentSeq = 0;
  return {
    paymentsRecorded,
    find: async () => invoice,
    findOrFail: async () => invoice,
    save: async () => undefined,
    nextInvoiceNumber: async () => 1,
    nextReceiptSequence: async () => 1,
    recordPayment: async (params) => {
      paymentSeq += 1;
      paymentsRecorded.push(params);
      return { paymentId: `pay-${paymentSeq}` };
    },
    recordRefund: async () => ({ refundId: "refund-1" }),
    findPaidChargesForSession: async (): Promise<PaidSessionCharge[]> => [],
    findLatestSucceededPayment: async () => null,
    findPaymentByProviderRef: async () => null,
    markPaymentSucceeded: async () => undefined,
    findRefundByProviderRef: async () => null,
    markRefundSucceeded: async () => undefined,
  };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

/**
 * Una unidad de trabajo cuya ENÉSIMA escritura revienta, como reventaría
 * Postgres al deshacer la transacción que cierra el cobro. Las lecturas
 * siguen funcionando, y las escrituras posteriores también: es exactamente el
 * escenario en el que el proveedor ya cobró y lo único que queda por decidir
 * es si de ese dinero queda rastro o no.
 */
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

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
}

function fakeSchoolBilling(merchantRef: string | null = "acct_test_123"): SchoolBillingPolicyPort {
  return {
    currency: async () => "EUR",
    defaultLocale: async () => "es-ES",
    country: async () => "ES",
    applicationFee: async () => ({ enabled: true, bps: 200, capCents: null }),
    merchantRef: async () => merchantRef,
    saveMerchantOnboarding: async () => undefined,
    updateMerchantStatus: async () => undefined,
  };
}

function fakeGateway(result: ChargeResult): PaymentGatewayPort & { chargeCalls: unknown[] } {
  const chargeCalls: unknown[] = [];
  return {
    chargeCalls,
    charge: async (params) => {
      chargeCalls.push(params);
      return result;
    },
    refund: vi.fn(),
    statusOf: vi.fn(),
  };
}

describe("RecordPaymentHandler (paso 9b: doble del puerto, sin red)", () => {
  it("un cobro que cubre el total marca la factura pagada y emite un recibo", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const gateway = fakeGateway({
      status: "succeeded",
      charge: { provider: PaymentProvider.Stripe, ref: "pi_test_1" },
    });

    const handler = new RecordPaymentHandler(
      invoices,
      fakeSchoolBilling(),
      gateway,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeLogger(),
    );

    const result = await handler.execute(
      new RecordPaymentCommand({
        invoiceId: INVOICE_ID.value,
        payerEmail: "alumno@example.com",
        idempotencyKey: "idem-1",
      }),
    );

    expect(result.status).toBe("succeeded");
    expect(result.invoiceStatus).toBe("paid");
    expect(result.amountCents).toBe(12_100);
    expect(result.receiptNumber).toBe("REC-2026-0001");
    expect(invoice.status).toBe("paid");

    // La comisión que se pide cobrar al proveedor es la congelada, proporcional
    // al importe cobrado — aquí el 100% del total, así que la comisión entera.
    expect(gateway.chargeCalls).toHaveLength(1);
    expect((gateway.chargeCalls[0] as { fee: { cents: number } }).fee.cents).toBe(242);
  });

  it("un cobro parcial deja la factura abierta pero SÍ emite recibo (parcial)", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const gateway = fakeGateway({
      status: "succeeded",
      charge: { provider: PaymentProvider.Stripe, ref: "pi_test_2" },
    });

    const handler = new RecordPaymentHandler(
      invoices,
      fakeSchoolBilling(),
      gateway,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeLogger(),
    );

    const result = await handler.execute(
      new RecordPaymentCommand({
        invoiceId: INVOICE_ID.value,
        payerEmail: "alumno@example.com",
        amountCents: 5_000,
        idempotencyKey: "idem-2",
      }),
    );

    expect(result.invoiceStatus).toBe("open");
    expect(result.amountCents).toBe(5_000);
    // No se espera al total: hay recibo igualmente.
    expect(result.receiptNumber).toBe("REC-2026-0001");
    expect(invoice.status).toBe("open");
  });

  it("un cobro fallido no marca la factura como pagada ni emite recibo", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const gateway = fakeGateway({
      status: "failed",
      charge: { provider: PaymentProvider.Stripe, ref: "pi_test_3" },
      failureCode: "card_declined",
      failureMessage: "La tarjeta fue rechazada.",
    });

    const handler = new RecordPaymentHandler(
      invoices,
      fakeSchoolBilling(),
      gateway,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeLogger(),
    );

    const result = await handler.execute(
      new RecordPaymentCommand({
        invoiceId: INVOICE_ID.value,
        payerEmail: "alumno@example.com",
        idempotencyKey: "idem-3",
      }),
    );

    expect(result.status).toBe("failed");
    expect(result.receiptNumber).toBeNull();
    expect(invoice.status).toBe("open");
    expect(invoice.amountPaidCents).toBe(0);
  });

  it("una factura YA PAGADA no llega a cobrarse: el proveedor no ve ni una llamada", async () => {
    // El fallo que cierra esta prueba: `gateway.charge()` corría ANTES de
    // `markPaid()`, que es quien lanza cuando el cobro no procede. Con esta
    // factura de 12100 ya pagada, mandar 5000 cobraba 50 € de verdad, deshacía
    // la transacción y no dejaba ni una fila en `payments`.
    const invoice = freshInvoice();
    invoice.markPaid({ amount: Money.of(12_100, "EUR"), method: "card", providerRef: "pi_ya", now: NOW });
    invoice.pullDomainEvents();

    const invoices = fakeInvoiceRepository(invoice);
    const gateway = fakeGateway({
      status: "succeeded",
      charge: { provider: PaymentProvider.Stripe, ref: "pi_test_4" },
    });

    const handler = new RecordPaymentHandler(
      invoices,
      fakeSchoolBilling(),
      gateway,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeLogger(),
    );

    await expect(
      handler.execute(
        new RecordPaymentCommand({
          invoiceId: INVOICE_ID.value,
          payerEmail: "alumno@example.com",
          amountCents: 5_000,
          idempotencyKey: "idem-4",
        }),
      ),
    ).rejects.toThrow(/estado/);

    expect(gateway.chargeCalls).toHaveLength(0);
    expect(invoices.paymentsRecorded).toHaveLength(0);
  });

  it("un cobro con éxito cuya transacción revienta deja rastro pendiente de reconciliar", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const gateway = fakeGateway({
      status: "succeeded",
      charge: { provider: PaymentProvider.Stripe, ref: "pi_test_5" },
    });

    const handler = new RecordPaymentHandler(
      invoices,
      fakeSchoolBilling(),
      gateway,
      // La primera escritura —la que cierra el cobro— se deshace entera.
      fakeUowFailingWriteNumber(1),
      fakeEvents(),
      fakeClock(),
      fakeLogger(),
    );

    await expect(
      handler.execute(
        new RecordPaymentCommand({
          invoiceId: INVOICE_ID.value,
          payerEmail: "alumno@example.com",
          idempotencyKey: "idem-5",
        }),
      ),
    ).rejects.toThrow(/deshizo/);

    // El proveedor cobró: ese dinero no puede desaparecer del registro. Queda
    // `pending` con la referencia del cobro, que es justo lo que
    // `ReconcilePaymentHandler` sabe cerrar cuando llegue el webhook.
    expect(gateway.chargeCalls).toHaveLength(1);
    expect(invoices.paymentsRecorded).toHaveLength(1);
    expect(invoices.paymentsRecorded[0]).toMatchObject({
      status: "pending",
      amountCents: 12_100,
      applicationFeeCents: 0,
      paidAt: null,
      charge: { provider: PaymentProvider.Stripe, ref: "pi_test_5" },
    });
  });
});
