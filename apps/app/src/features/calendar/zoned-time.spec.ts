import { describe, expect, it } from "vitest";
import { utcIsoToZonedInputValue, zonedTimeToUtcIso } from "./zoned-time.js";

describe("zonedTimeToUtcIso", () => {
  it("Europe/Madrid en julio (CEST, UTC+2): 16:00 local = 14:00 UTC", () => {
    expect(zonedTimeToUtcIso("2026-07-27T16:00", "Europe/Madrid")).toBe(
      "2026-07-27T14:00:00.000Z",
    );
  });

  it("Europe/Berlin en julio (CEST, UTC+2): la MISMA hora de pared que Madrid da el mismo instante", () => {
    expect(zonedTimeToUtcIso("2026-07-27T16:00", "Europe/Berlin")).toBe(
      "2026-07-27T14:00:00.000Z",
    );
  });

  it("America/Sao_Paulo (UTC-3, sin horario de verano desde 2019): 11:00 local = 14:00 UTC", () => {
    expect(zonedTimeToUtcIso("2026-07-27T11:00", "America/Sao_Paulo")).toBe(
      "2026-07-27T14:00:00.000Z",
    );
  });

  it("la MISMA marca UTC, vista desde tres escuelas, es la hora de pared de cada una", () => {
    const utc = "2026-07-27T14:00:00.000Z";
    expect(utcIsoToZonedInputValue(utc, "Europe/Madrid")).toBe("2026-07-27T16:00");
    expect(utcIsoToZonedInputValue(utc, "Europe/Berlin")).toBe("2026-07-27T16:00");
    expect(utcIsoToZonedInputValue(utc, "America/Sao_Paulo")).toBe("2026-07-27T11:00");
  });

  it("es inversa de utcIsoToZonedInputValue para las tres zonas del seed", () => {
    for (const timeZone of ["Europe/Madrid", "Europe/Berlin", "America/Sao_Paulo"]) {
      const original = "2026-03-15T09:30";
      const utc = zonedTimeToUtcIso(original, timeZone);
      expect(utcIsoToZonedInputValue(utc, timeZone)).toBe(original);
    }
  });

  it("un cambio de fecha por el desfase de zona horaria se refleja bien (medianoche en Sao Paulo cae en el día siguiente en UTC)", () => {
    // 21:30 en Sao Paulo (UTC-3) es 00:30 del día siguiente en UTC.
    expect(zonedTimeToUtcIso("2026-07-27T21:30", "America/Sao_Paulo")).toBe(
      "2026-07-28T00:30:00.000Z",
    );
  });
});
