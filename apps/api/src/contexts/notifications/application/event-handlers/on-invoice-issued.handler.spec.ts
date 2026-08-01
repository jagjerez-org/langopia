import { describe, expect, it } from "vitest";
import { InvoiceIssued } from "../../../billing/domain/events/invoice.events.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import type { RecipientCandidate } from "../../domain/model/recipient.js";
import type { InvoiceDirectoryPort } from "../../domain/ports/invoice-directory.port.js";
import type { MailerPort } from "../../domain/ports/mailer.port.js";
import type {
  PeopleDirectoryPort,
  StudentRecipientContext,
} from "../../domain/ports/people-directory.port.js";
import { OnInvoiceIssued } from "./on-invoice-issued.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const GUARDIAN_MEMBERSHIP_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_ID = "44444444-4444-4444-8444-444444444444";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function buildEvent(direction: "school_to_student" | "platform_to_school" = "school_to_student"): InvoiceIssued {
  return new InvoiceIssued({
    invoiceId: INVOICE_ID,
    schoolId: SCHOOL_ID,
    direction,
    number: "2026-0001",
    totalCents: 12_100,
    currency: "EUR",
    applicationFeeBps: 200,
    applicationFeeCents: 242,
  });
}

describe("OnInvoiceIssued", () => {
  it("con billToMembershipId, escribe a esa membresía sin volver a resolver al alumno", async () => {
    const sent: unknown[] = [];
    const invoices: InvoiceDirectoryPort = {
      findPayerContext: async () => ({
        billToMembershipId: GUARDIAN_MEMBERSHIP_ID,
        studentId: STUDENT_ID,
        number: "2026-0001",
        currency: "EUR",
        dueOn: new Date("2026-09-15T00:00:00Z"),
      }),
    };
    let studentLookedUp = false;
    const people: PeopleDirectoryPort = {
      findMembershipRecipient: async (): Promise<RecipientCandidate> => ({
        membershipId: GUARDIAN_MEMBERSHIP_ID,
        email: "tutor@example.com",
        name: "Tutor",
        membershipLocale: "pt-BR",
        userLocale: "es-ES",
      }),
      findStudentRecipientContext: async () => {
        studentLookedUp = true;
        return null;
      },
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnInvoiceIssued(invoices, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent());

    expect(studentLookedUp).toBe(false);
    expect(sent).toEqual([
      {
        to: "tutor@example.com",
        locale: "pt-BR",
        template: "invoice_issued",
        data: expect.objectContaining({ number: "2026-0001", totalCents: 12_100, currency: "EUR" }),
      },
    ]);
  });

  it("sin billToMembershipId, resuelve por el alumno (aplica la regla del menor)", async () => {
    const sent: unknown[] = [];
    const invoices: InvoiceDirectoryPort = {
      findPayerContext: async () => ({
        billToMembershipId: null,
        studentId: STUDENT_ID,
        number: "2026-0001",
        currency: "EUR",
        dueOn: null,
      }),
    };
    const people: PeopleDirectoryPort = {
      findMembershipRecipient: async () => null,
      findStudentRecipientContext: async (): Promise<StudentRecipientContext> => ({
        isMinor: false,
        student: {
          membershipId: STUDENT_ID,
          email: "adulto@example.com",
          name: "Nerea",
          membershipLocale: null,
          userLocale: "gl-ES",
        },
        guardians: [],
      }),
    };
    const mailer: MailerPort = {
      send: async (params) => {
        sent.push(params);
      },
    };

    const handler = new OnInvoiceIssued(invoices, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent());

    expect(sent).toEqual([
      expect.objectContaining({ to: "adulto@example.com", locale: "gl-ES" }),
    ]);
  });

  it("ignora las facturas platform_to_school: no le corresponde leerlas a ningún alumno", async () => {
    let queried = false;
    const invoices: InvoiceDirectoryPort = {
      findPayerContext: async () => {
        queried = true;
        return null;
      },
    };
    const people: PeopleDirectoryPort = {
      findMembershipRecipient: async () => null,
      findStudentRecipientContext: async () => null,
    };
    const mailer: MailerPort = { send: async () => undefined };

    const handler = new OnInvoiceIssued(invoices, people, mailer, fakeUow(), fakeLogger() as never);
    await handler.handle(buildEvent("platform_to_school"));

    expect(queried).toBe(false);
  });
});
