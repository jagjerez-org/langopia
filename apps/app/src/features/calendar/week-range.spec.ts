import { describe, expect, it } from "vitest";
import { addWeeks, weekRangeContaining } from "./week-range.js";

describe("weekRangeContaining", () => {
  it("2026-07-27 es lunes: la semana va de ese lunes al siguiente, en la zona de la escuela", () => {
    const reference = new Date("2026-07-27T10:00:00.000Z"); // lunes, mediodía en Madrid
    const week = weekRangeContaining(reference, "Europe/Madrid");

    expect(week.from).toBe("2026-07-26T22:00:00.000Z"); // lunes 00:00 CEST = domingo 22:00 UTC
    expect(week.to).toBe("2026-08-02T22:00:00.000Z"); // el lunes siguiente, mismo criterio
    expect(week.days).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("un jueves cae en la MISMA semana que su lunes", () => {
    const thursday = new Date("2026-07-30T23:00:00.000Z");
    const monday = new Date("2026-07-27T01:00:00.000Z");
    expect(weekRangeContaining(thursday, "Europe/Madrid")).toEqual(
      weekRangeContaining(monday, "Europe/Madrid"),
    );
  });

  it("la misma marca UTC cae en semanas distintas según la zona horaria de la escuela", () => {
    // 2026-07-26T23:30Z: ya es lunes en Madrid (01:30 CEST) pero sigue siendo
    // domingo en São Paulo (20:30 -03:00).
    const instant = new Date("2026-07-26T23:30:00.000Z");
    const madrid = weekRangeContaining(instant, "Europe/Madrid");
    const saoPaulo = weekRangeContaining(instant, "America/Sao_Paulo");

    expect(madrid.days[0]).toBe("2026-07-27");
    expect(saoPaulo.days[0]).toBe("2026-07-20");
  });
});

describe("addWeeks", () => {
  it("suma y resta semanas completas sin cambiar la hora del día", () => {
    const reference = new Date("2026-07-27T10:00:00.000Z");
    expect(addWeeks(reference, 1).toISOString()).toBe("2026-08-03T10:00:00.000Z");
    expect(addWeeks(reference, -1).toISOString()).toBe("2026-07-20T10:00:00.000Z");
  });
});
