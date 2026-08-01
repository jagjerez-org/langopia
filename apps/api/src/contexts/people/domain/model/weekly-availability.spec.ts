import { describe, expect, it } from "vitest";
import { WeeklyAvailability } from "./weekly-availability.vo.js";

describe("WeeklyAvailability", () => {
  it("acepta franjas en días distintos aunque coincidan en la hora", () => {
    const disponibilidad = WeeklyAvailability.of([
      { weekday: 1, startMinute: 9 * 60, endMinute: 14 * 60 },
      { weekday: 2, startMinute: 9 * 60, endMinute: 14 * 60 },
    ]);
    expect(disponibilidad.slots).toHaveLength(2);
  });

  it("rechaza dos franjas del mismo día que se solapan", () => {
    expect(() =>
      WeeklyAvailability.of([
        { weekday: 3, startMinute: 9 * 60, endMinute: 14 * 60 },
        { weekday: 3, startMinute: 13 * 60, endMinute: 17 * 60 },
      ]),
    ).toThrow(/solapa/i);
  });

  it("dos franjas que solo se tocan no se solapan", () => {
    const disponibilidad = WeeklyAvailability.of([
      { weekday: 4, startMinute: 9 * 60, endMinute: 14 * 60 },
      { weekday: 4, startMinute: 14 * 60, endMinute: 17 * 60 },
    ]);
    expect(disponibilidad.slots).toHaveLength(2);
  });

  it("detecta el solape sin importar el orden en que llegan las franjas", () => {
    expect(() =>
      WeeklyAvailability.of([
        { weekday: 5, startMinute: 16 * 60, endMinute: 20 * 60 },
        { weekday: 5, startMinute: 9 * 60, endMinute: 17 * 60 },
      ]),
    ).toThrow(/solapa/i);
  });

  it("rechaza una franja que termina antes o a la vez que empieza", () => {
    expect(() =>
      WeeklyAvailability.of([{ weekday: 1, startMinute: 600, endMinute: 600 }]),
    ).toThrow(/franja/i);
  });

  it("rechaza un día de la semana fuera de 1-7 (ISO-8601)", () => {
    expect(() =>
      WeeklyAvailability.of([{ weekday: 8, startMinute: 0, endMinute: 60 }]),
    ).toThrow(/día de la semana/i);
  });

  it("una disponibilidad vacía es válida", () => {
    expect(WeeklyAvailability.of([]).slots).toHaveLength(0);
  });
});
