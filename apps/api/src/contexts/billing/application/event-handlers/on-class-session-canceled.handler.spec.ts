import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import { ClassSessionCanceled } from "../../../scheduling/domain/events/class-session.events.js";
import { CancelingParty } from "../../../scheduling/domain/model/session-status.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type {
  InvoiceRepository,
  PaidSessionCharge,
} from "../../domain/ports/invoice.repository.port.js";
import { PaymentProvider } from "../../domain/ports/payment-gateway.port.js";
import { RefundPaymentCommand } from "../commands/refund-payment/refund-payment.command.js";
import { OnClassSessionCanceled } from "./on-class-session-canceled.handler.js";

const SESSION_ID = "55555555-5555-4555-8555-555555555555";
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";

function buildEvent(params: { refundDue: boolean }): ClassSessionCanceled {
  return new ClassSessionCanceled({
    sessionId: SESSION_ID,
    schoolId: SCHOOL_ID,
    groupId: "22222222-2222-4222-8222-222222222222",
    party: CancelingParty.Student,
    canceledByMembershipId: "33333333-3333-4333-8333-333333333333",
    reason: "Viaje",
    noticeHours: 2,
    refundDue: params.refundDue,
    start: new Date("2026-09-01T10:00:00Z"),
  });
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

function fakeInvoiceRepository(charges: PaidSessionCharge[]): InvoiceRepository {
  return {
    find: vi.fn(),
    findOrFail: vi.fn(),
    save: vi.fn(),
    nextInvoiceNumber: vi.fn(),
    nextReceiptSequence: vi.fn(),
    recordPayment: vi.fn(),
    recordRefund: vi.fn(),
    findPaidChargesForSession: async () => charges,
    findLatestSucceededPayment: vi.fn(),
    findPaymentByProviderRef: vi.fn(),
    markPaymentSucceeded: vi.fn(),
    findRefundByProviderRef: vi.fn(),
    markRefundSucceeded: vi.fn(),
  };
}

/** Un cobro por matriculado: la misma sesión en la factura de cada persona. */
function chargeOf(index: number, lineAmountCents = 2_500): PaidSessionCharge {
  return {
    invoiceId: `66666666-6666-4666-8666-00000000000${index}`,
    paymentId: `77777777-7777-4777-8777-00000000000${index}`,
    charge: { provider: PaymentProvider.Stripe, ref: `pi_test_${index}` },
    lineAmountCents,
    currency: "EUR",
  };
}

function fakeCommandBus() {
  return { execute: vi.fn().mockResolvedValue(undefined) };
}

describe("OnClassSessionCanceled", () => {
  it("sin derecho a devolución no busca ningún cobro ni ejecuta ningún comando", async () => {
    const invoices = fakeInvoiceRepository([]);
    const commands = fakeCommandBus();
    const handler = new OnClassSessionCanceled(
      invoices,
      fakeUow(),
      commands as never,
      fakeLogger(),
    );

    await handler.handle(buildEvent({ refundDue: false }));

    expect(commands.execute).not.toHaveBeenCalled();
  });

  it("con derecho a devolución y un cobro real, abre RefundPaymentCommand con la línea de esta sesión", async () => {
    const charge = chargeOf(1);
    const invoices = fakeInvoiceRepository([charge]);
    const commands = fakeCommandBus();
    const handler = new OnClassSessionCanceled(
      invoices,
      fakeUow(),
      commands as never,
      fakeLogger(),
    );

    await handler.handle(buildEvent({ refundDue: true }));

    expect(commands.execute).toHaveBeenCalledTimes(1);
    const dispatched = commands.execute.mock.calls[0]![0] as RefundPaymentCommand;
    expect(dispatched).toBeInstanceOf(RefundPaymentCommand);
    expect(dispatched.props).toEqual({
      invoiceId: charge.invoiceId,
      amountCents: 2_500,
      reason: "service_not_provided",
      idempotencyKey: `refund-session-${SESSION_ID}-${charge.invoiceId}`,
    });
  });

  it("una clase de GRUPO devuelve a todos los matriculados, no solo al primero", async () => {
    // El fallo que cierra esta prueba: `limit 1` en el repositorio. Con un
    // grupo de 8, siete personas se quedaban sin cobrar su devolución
    // mientras el registro decía «devolución abierta».
    const charges = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => chargeOf(i));
    const invoices = fakeInvoiceRepository(charges);
    const commands = fakeCommandBus();
    const handler = new OnClassSessionCanceled(
      invoices,
      fakeUow(),
      commands as never,
      fakeLogger(),
    );

    await handler.handle(buildEvent({ refundDue: true }));

    expect(commands.execute).toHaveBeenCalledTimes(8);

    const dispatched = commands.execute.mock.calls.map(
      (call) => (call[0] as RefundPaymentCommand).props,
    );
    expect(dispatched.map((props) => props.invoiceId)).toEqual(charges.map((c) => c.invoiceId));

    // Claves de idempotencia DISTINTAS: si las ocho compartieran clave, el
    // proveedor de pago trataría las siete últimas como reintentos de la
    // primera y solo devolvería a una persona.
    const keys = new Set(dispatched.map((props) => props.idempotencyKey));
    expect(keys.size).toBe(8);
  });

  it("si la devolución de un matriculado falla, se intentan las demás y el fallo no se traga", async () => {
    const charges = [1, 2, 3].map((i) => chargeOf(i));
    const invoices = fakeInvoiceRepository(charges);
    const commands = {
      execute: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("el proveedor rechazó la devolución"))
        .mockResolvedValueOnce(undefined),
    };
    const handler = new OnClassSessionCanceled(
      invoices,
      fakeUow(),
      commands as never,
      fakeLogger(),
    );

    await expect(handler.handle(buildEvent({ refundDue: true }))).rejects.toThrow(/rechazó/);
    expect(commands.execute).toHaveBeenCalledTimes(3);
  });

  it("con derecho a devolución pero sin ningún cobro real, no ejecuta ningún comando ni lanza", async () => {
    const invoices = fakeInvoiceRepository([]);
    const commands = fakeCommandBus();
    const handler = new OnClassSessionCanceled(
      invoices,
      fakeUow(),
      commands as never,
      fakeLogger(),
    );

    await expect(handler.handle(buildEvent({ refundDue: true }))).resolves.toBeUndefined();
    expect(commands.execute).not.toHaveBeenCalled();
  });
});
