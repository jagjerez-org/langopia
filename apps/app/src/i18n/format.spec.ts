import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatPercent, formatRelative } from "./format.js";

describe("formatMoney", () => {
  // U+00A0 (espacio no separable) entre la cifra y el símbolo: es lo que
  // devuelve de verdad `Intl.NumberFormat`, no un espacio normal.
  it("18940 céntimos en es-ES/EUR da «189,40 €»", () => {
    expect(formatMoney(18940, "EUR", "es-ES")).toBe("189,40 €");
  });

  it("18940 céntimos en pt-BR/BRL da «R$ 189,40»", () => {
    expect(formatMoney(18940, "BRL", "pt-BR")).toBe("R$ 189,40");
  });

  it("misma cifra, distinta moneda y locale: en-GB/EUR", () => {
    expect(formatMoney(18940, "EUR", "en-GB")).toBe("€189.40");
  });

  it("nunca divide entre 100 a mano por fuera: 0 céntimos es 0,00, no vacío", () => {
    expect(formatMoney(0, "EUR", "es-ES")).toBe("0,00 €");
  });

  it("importes negativos (una devolución) también se formatean", () => {
    expect(formatMoney(-500, "EUR", "es-ES")).toBe("-5,00 €");
  });
});

describe("formatPercent", () => {
  // U+00A0 (espacio no separable) antes de «%», igual que `formatMoney` con
  // el símbolo de la moneda: es lo que devuelve de verdad `Intl.NumberFormat`
  // en es-ES, no un espacio normal.
  it("0.5 da 50 %, sin decimales", () => {
    expect(formatPercent(0.5, "es-ES")).toBe("50 %");
  });

  it("un ratio exacto, como 1/6, se redondea a un entero", () => {
    expect(formatPercent(1 / 6, "es-ES")).toBe("17 %");
  });

  it("0 da 0 %, distinto de no tener dato (eso lo decide el componente con null, no esta función)", () => {
    expect(formatPercent(0, "es-ES")).toBe("0 %");
  });

  it("cambia de símbolo y espaciado según el idioma", () => {
    expect(formatPercent(0.5, "en-GB")).toBe("50%");
  });
});

describe("formatDate", () => {
  const instant = "2026-01-01T10:00:00Z";

  it("una fecha UTC se muestra en la zona de la escuela, no en una fija", () => {
    // Mismo instante, dos escuelas en dos zonas horarias distintas: la hora
    // local que se ve depende de `timeZone`, nunca del reloj del proceso.
    expect(formatDate(instant, "America/Sao_Paulo", "es-ES")).toBe("1 ene 2026, 7:00");
    expect(formatDate(instant, "Europe/Madrid", "es-ES")).toBe("1 ene 2026, 11:00");
  });

  it("el mismo instante y zona, en otro idioma, cambia el formato", () => {
    expect(formatDate(instant, "America/Sao_Paulo", "en-GB")).toBe("1 Jan 2026, 07:00");
    expect(formatDate(instant, "America/Sao_Paulo", "de-DE")).toBe("01.01.2026, 07:00");
    expect(formatDate(instant, "America/Sao_Paulo", "pt-BR")).toBe("1 de jan. de 2026, 07:00");
    expect(formatDate(instant, "America/Sao_Paulo", "gl-ES")).toBe("1 de xan. de 2026, 07:00");
  });

  it("admite opciones explícitas de Intl.DateTimeFormat", () => {
    expect(formatDate(instant, "Europe/Madrid", "es-ES", { dateStyle: "full" })).toContain("2026");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-07-27T12:00:00Z");

  it("un instante en el pasado reciente se expresa en horas", () => {
    expect(formatRelative("2026-07-27T10:00:00Z", "es-ES", now)).toBe("hace 2 horas");
  });

  it("un instante en el futuro se expresa como tal", () => {
    expect(formatRelative("2026-07-30T12:00:00Z", "es-ES", now)).toBe("dentro de 3 días");
  });

  it("cambia de idioma igual que el resto de formateadores", () => {
    expect(formatRelative("2026-07-27T10:00:00Z", "gl-ES", now)).toBe("hai 2 horas");
  });
});
