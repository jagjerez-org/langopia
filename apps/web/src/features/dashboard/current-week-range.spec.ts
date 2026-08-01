import { describe, expect, it } from "vitest";
import { currentWeekRange } from "./current-week-range.js";

describe("currentWeekRange (Tarea 6, Paso 5)", () => {
  it("un lunes cualquiera: el rango empieza en su propia medianoche local", () => {
    const monday = new Date(2026, 6, 27, 15, 0, 0); // lunes 27/07/2026, 15:00 local
    const range = currentWeekRange(monday);

    expect(range.from).toBe(new Date(2026, 6, 27, 0, 0, 0).toISOString());
    expect(range.to).toBe(new Date(2026, 7, 3, 0, 0, 0).toISOString());
  });

  it("un domingo: pertenece a la semana que empezó el lunes anterior, no a la siguiente", () => {
    const sunday = new Date(2026, 6, 26, 9, 0, 0); // domingo 26/07/2026
    const range = currentWeekRange(sunday);

    expect(range.from).toBe(new Date(2026, 6, 20, 0, 0, 0).toISOString());
    expect(range.to).toBe(new Date(2026, 6, 27, 0, 0, 0).toISOString());
  });

  it("un miércoles a media tarde: el rango cubre igualmente toda la semana, no solo lo que queda", () => {
    const wednesday = new Date(2026, 6, 29, 18, 30, 0);
    const range = currentWeekRange(wednesday);

    expect(range.from).toBe(new Date(2026, 6, 27, 0, 0, 0).toISOString());
    expect(range.to).toBe(new Date(2026, 7, 3, 0, 0, 0).toISOString());
  });

  it("el rango siempre abarca exactamente 7 días (para que la API calcule `weeks = 1`)", () => {
    const range = currentWeekRange(new Date(2026, 6, 27, 15, 0, 0));
    const spanMs = new Date(range.to).getTime() - new Date(range.from).getTime();

    expect(spanMs).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
