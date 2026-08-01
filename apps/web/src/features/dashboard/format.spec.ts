import { describe, expect, it } from "vitest";
import { formatHours, formatPercent } from "./format.js";

describe("formatPercent", () => {
  it("22 de 24 horas (el objetivo del Paso 6 del brief para Carla) da «92 %» en es-ES", () => {
    expect(formatPercent(22 / 24, "es-ES")).toBe("92 %");
  });

  it("9 de 24 horas (Marc) da «38 %», sin decimales", () => {
    expect(formatPercent(9 / 24, "es-ES")).toBe("38 %");
  });

  it("misma proporción, en-GB no usa espacio antes del símbolo", () => {
    expect(formatPercent(22 / 24, "en-GB")).toBe("92%");
  });

  it("0 es un valor real (escuela recién registrada), no una cadena vacía", () => {
    expect(formatPercent(0, "es-ES")).toBe("0 %");
  });

  it("una ocupación por encima del 100 % (más horas dadas que contratadas) también se formatea", () => {
    expect(formatPercent(1.2, "es-ES")).toBe("120 %");
  });
});

describe("formatHours", () => {
  it("un entero no arrastra decimales de más", () => {
    expect(formatHours(24, "es-ES")).toBe("24");
  });

  it("un valor con decimales se recorta a uno", () => {
    expect(formatHours(21.98, "es-ES")).toBe("22");
  });
});
