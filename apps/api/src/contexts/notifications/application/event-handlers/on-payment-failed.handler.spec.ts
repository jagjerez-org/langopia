import { describe, expect, it } from "vitest";
import { PaymentFailed } from "../../../billing/domain/events/invoice.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { RecipientCandidate } from "../../domain/model/recipient.js";
import type { InvoiceDirectoryPort } from "../../domain/ports/invoice-directory.port.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type { PeopleDirectoryPort } from "../../domain/ports/people-directory.port.js";
import { OnPaymentFailed } from "./on-payment-failed.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const GUARDIAN_MEMBERSHIP_ID = "33333333-3333-4333-8333-333333333333";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function buildEvent(): PaymentFailed {
  return new PaymentFailed({
    invoiceId: INVOICE_ID,
    schoolId: SCHOOL_ID,
    amountCents: 12_100,
    currency: "EUR",
    failureCode: "card_declined",
    failureMessage: "La tarjeta fue rechazada.",
  });
}

describe("OnPaymentFailed", () => {
  it("avisa a quien paga, con el número de factura que trae InvoiceDirectoryPort (el evento no lo lleva)", async () => {
    const sent: unknown[] = [];
    const invoices: InvoiceDirectoryPort = {
      findPayerContext: async () => ({
        billToMembershipId: GUARDIAN_MEMBERSHIP_ID,
        studentId: null,
        number: "2026-0007",
        currency: "EUR",
        dueOn: null,
      }),
    };
    const people: PeopleDirectoryPort = {
      findMembershipRecipient: async (): Promise<RecipientCandidate> => ({
        membershipId: GUARDIAN_MEMBERSHIP_ID,
        email: "tutor@example.com",
        name: "Tutor",
        membershipLocale: "en-GB",
        userLocale: "es-ES",
      }),
      findStudentRecipientContext: async () => null,
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnPaymentFailed(invoices, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent());

    expect(sent).toEqual([
      {
        to: "tutor@example.com",
        locale: "en-GB",
        template: "payment_failed",
        data: {
          name: "Tutor",
          number: "2026-0007",
          amountCents: 12_100,
          currency: "EUR",
          failureMessage: "La tarjeta fue rechazada.",
        },
      },
    ]);
  });

  it("si la factura no se encuentra, no envía nada ni falla", async () => {
    const invoices: InvoiceDirectoryPort = { findPayerContext: async () => null };
    let called = false;
    const people: PeopleDirectoryPort = {
      findMembershipRecipient: async () => {
        called = true;
        return null;
      },
      findStudentRecipientContext: async () => null,
    };
    const mailer: MailerPort = { send: async () => undefined };

    const handler = new OnPaymentFailed(invoices, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent());

    expect(called).toBe(false);
  });
});
