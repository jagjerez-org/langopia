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
import type { ProcessedWebhookEvents } from "../../../domain/ports/processed-webhook-events.port.js";
import { ReconcileRefundCommand } from "./reconcile-refund.command.js";
import { ReconcileRefundHandler } from "./reconcile-refund.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");
const STUDENT = StudentId.of("22222222-2222-4222-8222-222222222222");
const INVOICE_ID = InvoiceId.of("55555555-5555-4555-8555-555555555555");
const REFUND_REF = "re_test_pending_1";

/** Una factura ya cobrada del todo (12100 = 10000 + 21% IVA), comisión 2% → 242. */
function paidInvoice(): Invoice {
  const invoice = Invoice.issue({
    id: INVOICE_ID,
    schoolId: SCHOOL,
    direction: InvoiceDirection.SchoolToStudent,
    studentId: STUDENT,
    currency: "EUR",
    locale: "es-ES",
    lines: [
      { id: "77777777-7777-4777-8777-777777777777", description: "Curso de portugués", quantity: 1, unitCents: 10_000 },
    ],
    taxRateBps: 2100,
    feeBps: 200,
    number: "2026-0002",
    issuedOn: NOW,
    dueOn: NOW,
  });
  invoice.markPaid({ amount: Money.of(12_100, "EUR"), method: "card", providerRef: "pi_already_paid", now: NOW });
  invoice.pullDomainEvents(); // limpia: solo interesan los eventos de LA devolución
  return invoice;
}

/** Doble en memoria: una devolución parcial (5000 de 12100) todavía `pending`. */
function fakeInvoiceRepository(invoice: Invoice) {
  let status: "pending" | "succeeded" | "failed" = "pending";
  const markRefundSucceededCalls: unknown[] = [];

  const repo: InvoiceRepository & { markRefundSucceededCalls: unknown[] } = {
    markRefundSucceededCalls,
    find: async () => invoice,
    findOrFail: async () => invoice,
    save: async () => undefined,
    nextInvoiceNumber: async () => 1,
    nextReceiptSequence: async () => 1,
    recordPayment: async () => ({ paymentId: "pay-1" }),
    recordRefund: async () => ({ refundId: "refund-1" }),
    findPaidChargesForSession: async (): Promise<PaidSessionCharge[]> => [],
    findLatestSucceededPayment: async () => null,
    findPaymentByProviderRef: async () => null,
    markPaymentSucceeded: async () => undefined,
    findRefundByProviderRef: async (ref) => {
      if (ref !== REFUND_REF) return null;
      return {
        refundId: "refund-pending-1",
        invoiceId: invoice.id.value,
        status,
        amountCents: 5_000,
        currency: invoice.currency,
        reason: "requested_by_customer",
      };
    },
    markRefundSucceeded: async (params) => {
      markRefundSucceededCalls.push(params);
      status = "succeeded";
    },
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

describe("ReconcileRefundHandler (paso 4: charge.refunded ya traducido)", () => {
  it("confirma una devolución pendiente y revierte la comisión proporcional", async () => {
    const invoice = paidInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcileRefundHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const result = await handler.execute(new ReconcileRefundCommand({ refundRef: REFUND_REF }));

    expect(result.applied).toBe(true);
    // 242 (comisión total) * 5000/12100 = 100 exactos.
    expect(result.feeReversedCents).toBe(100);
    expect(invoice.amountRefundedCents).toBe(5_000);
    expect(invoices.markRefundSucceededCalls).toEqual([
      { refundId: "refund-pending-1", applicationFeeReversedCents: 100, processedAt: NOW, fullyRefunded: false },
    ]);
  });

  it("dos entregas SIMULTÁNEAS del mismo evento emiten un solo abono", async () => {
    // Igual que en `ReconcilePaymentHandler`: sin reclamar el identificador
    // del evento, dos entregas a la vez leen las dos la devolución `pending`
    // y las dos emiten abono.
    const invoice = paidInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    // La confirmación de la primera entrega no es visible para la segunda.
    invoices.markRefundSucceeded = async (params) => {
      invoices.markRefundSucceededCalls.push(params);
    };

    const processedEvents = fakeProcessedEvents();
    const handler = new ReconcileRefundHandler(
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
        new ReconcileRefundCommand({
          refundRef: REFUND_REF,
          eventId: "evt_test_refund_1",
          eventType: "charge.refunded",
        }),
      );

    const [first, second] = await Promise.all([delivery(), delivery()]);

    expect([first.applied, second.applied].filter(Boolean)).toHaveLength(1);
    expect(invoices.markRefundSucceededCalls).toHaveLength(1);
    expect(invoice.amountRefundedCents).toBe(5_000);
    expect(processedEvents.claimed).toEqual(["evt_test_refund_1"]);
  });

  it("el mismo evento entregado dos veces no revierte comisión dos veces", async () => {
    const invoice = paidInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcileRefundHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const first = await handler.execute(new ReconcileRefundCommand({ refundRef: REFUND_REF }));
    const second = await handler.execute(new ReconcileRefundCommand({ refundRef: REFUND_REF }));

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(invoices.markRefundSucceededCalls).toHaveLength(1);
    expect(invoice.amountRefundedCents).toBe(5_000);
  });

  it("una devolución que no conocemos no toca nada", async () => {
    const invoice = paidInvoice();
    const invoices = fakeInvoiceRepository(invoice);
    const handler = new ReconcileRefundHandler(
      invoices,
      fakeUow(),
      fakeEvents(),
      fakeClock(),
      fakeTenant(),
      fakeProcessedEvents(),
      fakeLogger(),
    );

    const result = await handler.execute(
      new ReconcileRefundCommand({ refundRef: "re_desconocida" }),
    );

    expect(result.applied).toBe(false);
    expect(invoice.amountRefundedCents).toBe(0);
  });
});
