import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "../../../shared/infrastructure/i18n/locale.resolver.js";
import { EMAIL_TEMPLATES } from "../../domain/ports/mailer.port.js";
import { renderEmail } from "./email-templates.js";

/**
 * Datos de sobra para todas las plantillas: cada `render` solo lee las claves
 * que le tocan, así que un único objeto realista sirve para todas.
 */
const SAMPLE_DATA = {
  name: "Nerea",
  startsAt: "2026-09-01T08:00:00.000Z",
  previousStart: "2026-09-01T08:00:00.000Z",
  newStart: "2026-09-02T08:00:00.000Z",
  reason: "el profesor está enfermo",
  number: "2026-0001",
  totalCents: 12_100,
  amountCents: 12_100,
  currency: "EUR",
  dueOn: "2026-09-15",
  failureMessage: "La tarjeta fue rechazada.",
  impersonatorName: "Ana Soporte",
};

describe("plantillas de correo: cobertura de idioma (paso 5 del brief)", () => {
  it("cada aviso se renderiza en los cinco idiomas soportados, con asunto y cuerpo", () => {
    const gaps: string[] = [];

    for (const template of EMAIL_TEMPLATES) {
      for (const locale of SUPPORTED_LOCALES) {
        const rendered = renderEmail(template, locale, SAMPLE_DATA);
        if (!rendered.subject.trim() || !rendered.text.trim()) {
          gaps.push(`${template} → ${locale}: asunto o cuerpo vacío`);
        }
      }
    }

    expect(gaps, gaps.join("\n")).toEqual([]);
  });

  it("un idioma desconocido cae al español en vez de fallar el envío", () => {
    const rendered = renderEmail("student_welcome", "fr-FR", SAMPLE_DATA);
    expect(rendered.subject).toBe("¡Bienvenido/a!");
  });

  it("las plantillas con importe no dejan restos de coma flotante (el céntimo ya viene decidido)", () => {
    const rendered = renderEmail("invoice_issued", "es-ES", SAMPLE_DATA);
    expect(rendered.text).toContain("121");
  });
});
