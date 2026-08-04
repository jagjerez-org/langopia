import { describe, expect, it } from "vitest";
import { layoutDayLanes } from "./day-lanes.js";

type Fixture = { id: string; startMinutes: number; endMinutes: number };

describe("layoutDayLanes", () => {
  it("clases que no se solapan van todas en el carril 0", () => {
    const entries: Fixture[] = [
      { id: "a", startMinutes: 0, endMinutes: 60 },
      { id: "b", startMinutes: 60, endMinutes: 120 },
      { id: "c", startMinutes: 180, endMinutes: 240 },
    ];
    const result = layoutDayLanes(entries);
    expect(result.every((entry) => entry.lane === 0 && entry.laneCount === 1)).toBe(true);
  });

  it("dos clases solapadas se reparten en dos carriles, cada una con laneCount 2", () => {
    const entries: Fixture[] = [
      { id: "a", startMinutes: 0, endMinutes: 60 },
      { id: "b", startMinutes: 30, endMinutes: 90 },
    ];
    const result = layoutDayLanes(entries);
    const byId = Object.fromEntries(result.map((entry) => [entry.id, entry]));
    expect(byId.a!.lane).not.toBe(byId.b!.lane);
    expect(byId.a!.laneCount).toBe(2);
    expect(byId.b!.laneCount).toBe(2);
  });

  it("tres clases que se solapan las tres a la vez usan tres carriles", () => {
    const entries: Fixture[] = [
      { id: "a", startMinutes: 0, endMinutes: 90 },
      { id: "b", startMinutes: 10, endMinutes: 100 },
      { id: "c", startMinutes: 20, endMinutes: 110 },
    ];
    const result = layoutDayLanes(entries);
    const lanes = new Set(result.map((entry) => entry.lane));
    expect(lanes.size).toBe(3);
    expect(result.every((entry) => entry.laneCount === 3)).toBe(true);
  });

  it("tocarse en el mismo minuto no cuenta como solape", () => {
    const entries: Fixture[] = [
      { id: "a", startMinutes: 0, endMinutes: 60 },
      { id: "b", startMinutes: 60, endMinutes: 120 },
    ];
    const result = layoutDayLanes(entries);
    expect(result.every((entry) => entry.lane === 0 && entry.laneCount === 1)).toBe(true);
  });

  it("conserva el resto de campos del objeto original", () => {
    const entries = [{ id: "a", startMinutes: 0, endMinutes: 30, extra: "dato" }];
    const [result] = layoutDayLanes(entries);
    expect(result!.extra).toBe("dato");
  });
});
