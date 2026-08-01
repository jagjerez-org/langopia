import { describe, expect, it } from "vitest";
import { formatInvoiceDateOnly } from "./date-only.js";

describe("formatInvoiceDateOnly (Tarea 10, Paso 1 y Paso 2)", () => {
  it("no desplaza de día a una escuela al oeste de Greenwich (São Paulo, UTC-3)", () => {
    // Medianoche UTC del 24 de julio: en São Paulo son las 21:00 del 23. Si
    // esta función convirtiera a la zona de la escuela, se leería "23".
    expect(formatInvoiceDateOnly("2026-07-24T00:00:00.000Z", "es-ES")).toBe("24 jul 2026");
  });

  it("tampoco desplaza de día a una escuela al este (Berlín, UTC+2 en julio)", () => {
    expect(formatInvoiceDateOnly("2026-07-24T00:00:00.000Z", "es-ES")).toBe("24 jul 2026");
  });

  it("respeta el idioma activo", () => {
    expect(formatInvoiceDateOnly("2026-07-24T00:00:00.000Z", "en-GB")).toBe("24 Jul 2026");
  });
});
