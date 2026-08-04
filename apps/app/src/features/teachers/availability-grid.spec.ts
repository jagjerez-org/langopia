import { describe, expect, it } from "vitest";
import { cellKey, gridHours, cellsFromSlots, slotsFromCells } from "./availability-grid.js";

describe("gridHours", () => {
  it("cubre de 6 a 22, ambos incluidos", () => {
    const hours = gridHours();
    expect(hours[0]).toBe(6);
    expect(hours[hours.length - 1]).toBe(22);
    expect(hours).toHaveLength(17);
  });
});

describe("cellsFromSlots", () => {
  it("marca activa cada hora que cubre una franja, sin incluir la hora de fin", () => {
    // Igual que el seed (`weekday: 1, from: 9, to: 14`): 9-14 cubre las horas 9,10,11,12,13.
    const cells = cellsFromSlots([{ weekday: 1, startMinute: 9 * 60, endMinute: 14 * 60 }]);
    expect(cells.has(cellKey(1, 9))).toBe(true);
    expect(cells.has(cellKey(1, 13))).toBe(true);
    expect(cells.has(cellKey(1, 14))).toBe(false);
    expect(cells.has(cellKey(2, 9))).toBe(false);
  });

  it("varias franjas del mismo día se combinan", () => {
    const cells = cellsFromSlots([
      { weekday: 3, startMinute: 9 * 60, endMinute: 11 * 60 },
      { weekday: 3, startMinute: 16 * 60, endMinute: 18 * 60 },
    ]);
    expect(cells.has(cellKey(3, 9))).toBe(true);
    expect(cells.has(cellKey(3, 10))).toBe(true);
    expect(cells.has(cellKey(3, 11))).toBe(false); // fin de la primera franja, no cubierta
    expect(cells.has(cellKey(3, 16))).toBe(true);
    expect(cells.has(cellKey(3, 17))).toBe(true);
  });
});

describe("slotsFromCells", () => {
  it("fusiona horas contiguas del mismo día en una sola franja", () => {
    const cells = new Set([cellKey(1, 9), cellKey(1, 10), cellKey(1, 11), cellKey(1, 12), cellKey(1, 13)]);
    expect(slotsFromCells(cells)).toEqual([{ weekday: 1, startMinute: 540, endMinute: 840 }]);
  });

  it("dos tramos separados del mismo día producen dos franjas", () => {
    const cells = new Set([cellKey(3, 9), cellKey(3, 10), cellKey(3, 16), cellKey(3, 17)]);
    expect(slotsFromCells(cells)).toEqual([
      { weekday: 3, startMinute: 9 * 60, endMinute: 11 * 60 },
      { weekday: 3, startMinute: 16 * 60, endMinute: 18 * 60 },
    ]);
  });

  it("es la inversa de cellsFromSlots para las franjas del seed", () => {
    const original = [
      { weekday: 1, startMinute: 9 * 60, endMinute: 14 * 60 },
      { weekday: 3, startMinute: 16 * 60, endMinute: 21 * 60 },
    ];
    expect(slotsFromCells(cellsFromSlots(original))).toEqual(original);
  });

  it("cuadrícula vacía no produce ninguna franja", () => {
    expect(slotsFromCells(new Set())).toEqual([]);
  });
});
