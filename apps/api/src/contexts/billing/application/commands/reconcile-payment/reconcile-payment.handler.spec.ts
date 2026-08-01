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
import type {
  InvoiceRepository,
  PaidSessionCharge,
} from "../../../domain/ports/invoice.repository.port.js";
import type { ProcessedWebhookEvents } from "../../../domain/ports/processed-webhook-events.port.js";
import { ReconcilePaymentCommand } from "./reconcile-payment.command.js";
import { ReconcilePaymentHandler } from "./reconcile-payment.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const STUDENT = StudentId.of("22222222-2222-4222-8222-222222222222");
const INVOICE_ID = InvoiceId.of("55555555-5555-4555-8555-555555555555");
const PAYMENT_ID = "66666666-6666-4666-8666-666666666666";
const CHARGE_REF = "pi_test_pending_1";

function freshInvoice(): Invoice {
  return Invoice.issue({
    id: INVOICE_ID,
    schoolId: SCHOOL,
    direction: InvoiceDirection.SchoolToStudent,
    studentId: STUDENT,
    currency: "EUR",
    locale: "es-ES",
    lines: [
      { id: "77777777-7777-4777-8777-777777777777", description: "Curso de alemán", quantity: 1, unitCents: 10_000 },
    ],
    taxRateBps: 2100, // total 12100
    feeBps: 200,
    number: "2026-0001",
    issuedOn: NOW,
    dueOn: NOW,
  });
}

/** Doble en memoria: un único cobro `pending`, tal como lo dejó `RecordPaymentHandler`
 * cuando el proveedor no confirmó al instante. `markPaymentSucceeded` lo pasa a
 * `succeeded` de verdad, para que una segunda entrega del mismo evento lo encuentre
 * ya reconciliado — es la propia prueba de idempotencia (paso 5b), no un doble que
 * finge estarlo. */
function fakeInvoiceRepository(invoice: Invoice) {
  let status: "pending" | "succeeded" | "failed" = "pending";
  const markPaymentSucceededCalls: unknown[] = [];
  const saveCalls: Invoice[] = [];

  const repo: InvoiceRepository & {
    markPaymentSucceededCalls: unknown[];
    saveCalls: Invoice[];
  } = {
    markPaymentSucceededCalls,
    saveCalls,
    find: async () => invoice,
    findOrFail: async () => invoice,
    save: async (inv) => {
      saveCalls.push(inv);
    },
    nextInvoiceNumber: async () => 1,
    nextReceiptSequence: async () => 1,
    recordPayment: async () => ({ paymentId: PAYMENT_ID }),
    recordRefund: async () => ({ refundId: "refund-1" }),
    findPaidChargesForSession: async (): Promise<PaidSessionCharge[]> => [],
    findLatestSucceededPayment: async () => null,
    findPaymentByProviderRef: async (ref) => {
      if (ref !== CHARGE_REF) return null;
      return {
        paymentId: PAYMENT_ID,
        invoiceId: invoice.id.value,
        status,
        amountCents: invoice.totalCents,
        currency: invoice.currency,
        method: "card",
      };
    },
    markPaymentSucceeded: async (params) => {
      markPaymentSucceededCalls.push(params);
      status = "succeeded";
    },
    findRefundByProviderRef: async () => null,
    markRefundSucceeded: async () => undefined,
  };
  return repo;
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeEvents(): EventPublisher & { published: unknown[] } {
  const published: unknown[] = [];
  return { published, publish: async (events) => void published.push(...events) };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => SCHOOL.value,
    membershipId: () => null,
    roles: () => [],
    has: () => false,
  };
}

/**
 * Doble del registro de eventos ya procesados: modela el índice único
 * (`provider`, `event_id`) con un conjunto en memoria — reclamar dos veces el
 * mismo identificador solo tiene éxito la primera.
 */
function fakeProcessedEvents(): ProcessedWebhookEvents & { claimed: string[] } {
  const claimed: string[] = [];
  return {
    claimed,
    claim: async ({ eventId }) => {
      if (claimed.includes(eventId)) return false;
      claimed.push(eventId);
      return true;
    },
  };
}

describe("ReconcilePaymentHandler (paso 4: payment_intent.succeeded ya traducido)", () => {
  it("confirma un cobro pendiente: marca la factura pagada y emite recibo", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const events = fakeEvents();
    const handler = new ReconcilePaymentHandler(
      invoices,
      fakeUow(),
      events,
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const result = await handler.execute(new ReconcilePaymentCommand({ chargeRef: CHARGE_REF }));

    expect(result.applied).toBe(true);
    expect(result.invoiceStatus).toBe("paid");
    expect(result.receiptNumber).toBe("REC-2026-0001");
    expect(invoice.status).toBe("paid");
    expect(invoices.markPaymentSucceededCalls).toHaveLength(1);
    expect(events.published.length).toBeGreaterThan(0);
  });

  it("paso 5b — el mismo evento entregado dos veces no cobra dos veces: la segunda es un no-op", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcilePaymentHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const first = await handler.execute(new ReconcilePaymentCommand({ chargeRef: CHARGE_REF }));
    const second = await handler.execute(new ReconcilePaymentCommand({ chargeRef: CHARGE_REF }));

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.receiptNumber).toBeNull();
    // Lo único que importaba: reconciliar dos veces no llama dos veces a
    // `markPaymentSucceeded` ni marca pagada la factura una segunda vez.
    expect(invoices.markPaymentSucceededCalls).toHaveLength(1);
    expect(invoice.amountPaidCents).toBe(12_100);
  });

  it("dos entregas SIMULTÁNEAS del mismo evento emiten un solo recibo", async () => {
    // El fallo que cierra esta prueba: el identificador del evento se tiraba a
    // la basura, y la idempotencia dependía de ver el cobro ya `succeeded`.
    // Dos entregas a la vez leen las dos `pending` —ninguna ve el trabajo de
    // la otra hasta que confirma—, así que las dos reconciliaban y salían dos
    // recibos con el MISMO número y dos correos a quien paga.
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    // La confirmación de la primera entrega todavía no es visible para la
    // segunda: es lo que ocurre entre dos transacciones sin confirmar.
    invoices.markPaymentSucceeded = async (params) => {
      invoices.markPaymentSucceededCalls.push(params);
    };

    const processedEvents = fakeProcessedEvents();
    const handler = new ReconcilePaymentHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      processedEvents,
      fakeLogger(),
    );

    const delivery = () =>
      handler.execute(
        new ReconcilePaymentCommand({
          chargeRef: CHARGE_REF,
          eventId: "evt_test_1",
          eventType: "payment_intent.succeeded",
        }),
      );

    const [first, second] = await Promise.all([delivery(), delivery()]);

    expect([first.applied, second.applied].filter(Boolean)).toHaveLength(1);
    expect([first.receiptNumber, second.receiptNumber].filter(Boolean)).toEqual(["REC-2026-0001"]);
    expect(invoices.markPaymentSucceededCalls).toHaveLength(1);
    expect(processedEvents.claimed).toEqual(["evt_test_1"]);
  });

  it("si el importe del proveedor difiere del nuestro, manda el del proveedor", async () => {
    // Nuestra fila dice 12100 (lo que pedimos cobrar); el evento dice que se
    // cobraron 11000. Quien movió el dinero es el proveedor: quedarse con el
    // nuestro descuadraría la factura y el recibo.
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcilePaymentHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const result = await handler.execute(
      new ReconcilePaymentCommand({ chargeRef: CHARGE_REF, amountCents: 11_000, currency: "EUR" }),
    );

    expect(result.applied).toBe(true);
    expect(invoice.amountPaidCents).toBe(11_000);
    // Sigue abierta: 11000 no cubren los 12100 de la factura.
    expect(invoice.status).toBe("open");
    // Y la fila del cobro se corrige con el importe real, con su comisión
    // proporcional (2 % de 11000 sobre 12100 → 220).
    expect(invoices.markPaymentSucceededCalls[0]).toMatchObject({
      amountCents: 11_000,
      currency: "EUR",
      applicationFeeCents: 220,
    });
  });

  it("sin importe en el evento, se usa el registrado: es el único que hay", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcilePaymentHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    await handler.execute(new ReconcilePaymentCommand({ chargeRef: CHARGE_REF }));

    expect(invoice.amountPaidCents).toBe(12_100);
    expect(invoices.markPaymentSucceededCalls[0]).toMatchObject({ amountCents: 12_100 });
  });

  it("un evento sobre un cobro que no reconocemos no toca nada", async () => {
    const invoice = freshInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcilePaymentHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const result = await handler.execute(
      new ReconcilePaymentCommand({ chargeRef: "pi_no_lo_conocemos" }),
    );

    expect(result.applied).toBe(false);
    expect(result.invoiceId).toBeNull();
    expect(invoice.status).toBe("open");
  });
});
