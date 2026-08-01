import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { InvoiceStatus } from "../../../domain/model/invoice-status.js";
import type { Invoice } from "../../../domain/model/invoice.aggregate.js";
import type {
  InvoiceRepository,
  PaidSessionCharge,
} from "../../../domain/ports/invoice.repository.port.js";
import type { SchoolBillingPolicyPort } from "../../../domain/ports/school-billing-policy.port.js";
import { IssueInvoiceCommand } from "./issue-invoice.command.js";
import { IssueInvoiceHandler } from "./issue-invoice.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeIds(): IdGenerator {
  let n = 0;
  // Formato UUID válido de verdad: `InvoiceId.of(...)` (y `InvoiceLine`, para
  // cada línea) lo exigen — un `id-1` cualquiera no pasa su validación.
  return {
    generate: () => `99999999-9999-4999-8999-${String((n += 1)).padStart(12, "0")}`,
  };
}

function fakeTenant(): TenantContext {
  return {
    schoolId: () => SCHOOL_ID,
    membershipId: () => null,
    roles: () => ["owner"],
    has: (role) => role === "owner",
  };
}

/** Escuela SIN comerciante dado de alta (`merchantRef` → null, como una escuela `not_started`). */
function fakeSchoolBilling(): SchoolBillingPolicyPort & { merchantRefCalls: number } {
  let merchantRefCalls = 0;
  return {
    get merchantRefCalls() {
      return merchantRefCalls;
    },
    currency: async () => "EUR",
    defaultLocale: async () => "es-ES",
    country: async () => "DE",
    applicationFee: async () => ({ enabled: false, bps: 0, capCents: null }),
    merchantRef: async () => {
      merchantRefCalls += 1;
      return null;
    },
    saveMerchantOnboarding: async () => undefined,
    updateMerchantStatus: async () => undefined,
  };
}

function fakeInvoiceRepository(saved: Invoice[]): InvoiceRepository {
  return {
    find: async () => null,
    findOrFail: async () => {
      throw new Error("no usado en esta prueba");
    },
    save: async (invoice) => {
      saved.push(invoice);
    },
    nextInvoiceNumber: async () => 1,
    nextReceiptSequence: async () => 1,
    recordPayment: async () => ({ paymentId: "pay-1" }),
    recordRefund: async () => ({ refundId: "refund-1" }),
    findPaidChargesForSession: async (): Promise<PaidSessionCharge[]> => [],
    findLatestSucceededPayment: async () => null,
    findPaymentByProviderRef: async () => null,
    markPaymentSucceeded: async () => undefined,
    findRefundByProviderRef: async () => null,
    markRefundSucceeded: async () => undefined,
  };
}

describe("IssueInvoiceHandler (paso 5: sin comerciante activo, la factura queda abierta sin intentar cobrar)", () => {
  it("emite en open aunque la escuela no tenga comerciante dado de alta, sin mirar siquiera su estado", async () => {
    const saved: Invoice[] = [];
    const invoices = fakeInvoiceRepository(saved);
    const schoolBilling = fakeSchoolBilling();
    const handler = new IssueInvoiceHandler(
      invoices,
      schoolBilling,
      fakeUow(),
      fakeEvents(),
      fakeTenant(),
      fakeClock(),
      fakeIds(),
    );

    const result = await handler.execute(
      new IssueInvoiceCommand({
        direction: "school_to_student",
        studentId: "22222222-2222-4222-8222-222222222222",
        lines: [{ description: "Curso de alemán", quantity: 1, unitCents: 10_000 }],
        dueOn: "2026-08-15",
      }),
    );

    expect(saved).toHaveLength(1);
    expect(saved[0]!.status).toBe(InvoiceStatus.Open);
    expect(result.totalCents).toBe(12_100); // 10000 + 21% IVA
    // La regla que gobierna el diseño: emitir NUNCA depende de si hay
    // comerciante. `merchantRef()` ni siquiera se llama — cobrar es un paso
    // posterior y explícito (`RecordPaymentCommand`), nunca un efecto
    // automático de emitir una factura.
    expect(schoolBilling.merchantRefCalls).toBe(0);
  });
});
