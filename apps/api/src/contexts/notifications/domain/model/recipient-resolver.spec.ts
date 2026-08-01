import { describe, expect, it } from "vitest";
import type { GuardianCandidate, RecipientCandidate } from "./recipient.js";
import { NoGuardianForMinorError, resolveStudentRecipient } from "./recipient-resolver.js";

const ADULT: RecipientCandidate = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  email: "adulto@example.com",
  name: "Nerea Alumna",
  membershipLocale: "de-DE",
  userLocale: "es-ES",
};

const MINOR: RecipientCandidate = {
  membershipId: "22222222-2222-4222-8222-222222222222",
  email: "menor@example.com",
  name: "Adrián Alumno",
  membershipLocale: null,
  userLocale: "es-ES",
};

const TUTOR: GuardianCandidate = {
  membershipId: "33333333-3333-4333-8333-333333333333",
  email: "tutor@example.com",
  name: "Tutor de Adrián",
  membershipLocale: "pt-BR",
  userLocale: "es-ES",
  isBillingContact: true,
};

const OTHER_GUARDIAN: GuardianCandidate = {
  membershipId: "44444444-4444-4444-8444-444444444444",
  email: "otro-tutor@example.com",
  name: "Otro tutor",
  membershipLocale: "en-GB",
  userLocale: "es-ES",
  isBillingContact: false,
};

describe("resolveStudentRecipient (paso 2: selector de idioma y destinatario)", () => {
  it("un alumno adulto recibe el correo él mismo, en el idioma de su membresía", () => {
    const recipient = resolveStudentRecipient({
      studentId: "student-adulto",
      isMinor: false,
      student: ADULT,
      guardians: [],
    });

    expect(recipient).toEqual({
      email: "adulto@example.com",
      name: "Nerea Alumna",
      locale: "de-DE",
    });
  });

  it("un alumno menor con tutor: el correo va al tutor con is_billing_contact, nunca al menor", () => {
    const recipient = resolveStudentRecipient({
      studentId: "student-menor",
      isMinor: true,
      student: MINOR,
      guardians: [OTHER_GUARDIAN, TUTOR],
    });

    expect(recipient).toEqual({
      email: "tutor@example.com",
      name: "Tutor de Adrián",
      locale: "pt-BR",
    });
  });

  it("una persona sin locale propio en la membresía hereda el idioma de su usuario", () => {
    const recipient = resolveStudentRecipient({
      studentId: "student-menor",
      isMinor: true,
      student: MINOR,
      // Ningún tutor tiene `is_billing_contact`: se usa el único disponible,
      // y como tampoco fijó idioma para esta escuela, cae al de su usuario.
      guardians: [{ ...TUTOR, isBillingContact: false, membershipLocale: null }],
    });

    expect(recipient.locale).toBe("es-ES");
  });

  it("un alumno menor sin ningún tutor registrado no se escribe: es un dato roto, no un destinatario", () => {
    expect(() =>
      resolveStudentRecipient({
        studentId: "student-sin-tutor",
        isMinor: true,
        student: MINOR,
        guardians: [],
      }),
    ).toThrow(NoGuardianForMinorError);
  });
});
