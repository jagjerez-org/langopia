import { describe, expect, it } from "vitest";
import { TimeSlot } from "./time-slot.vo.js";

describe("TimeSlot", () => {
  const monday10 = new Date("2026-09-07T10:00:00Z");

  it("acepta una clase de 60 minutos", () => {
    const slot = TimeSlot.fromDuration(monday10, 60);
    expect(slot.durationMinutes).toBe(60);
    expect(slot.end.toISOString()).toBe("2026-09-07T11:00:00.000Z");
  });

  it("rechaza una clase de menos de 15 minutos", () => {
    expect(() => TimeSlot.fromDuration(monday10, 10)).toThrow(/15 minutos/);
  });

  it("rechaza una clase de más de 4 horas", () => {
    expect(() => TimeSlot.fromDuration(monday10, 300)).toThrow(/240 minutos/);
  });

  it("rechaza que el fin no sea posterior al inicio", () => {
    expect(() => TimeSlot.of(monday10, monday10)).toThrow(/posterior/);
  });

  it("detecta solape entre franjas", () => {
    const a = TimeSlot.fromDuration(monday10, 60);
    const b = TimeSlot.fromDuration(new Date("2026-09-07T10:30:00Z"), 60);
    expect(a.overlaps(b)).toBe(true);
  });

  it("no considera solape que dos clases se toquen", () => {
    const a = TimeSlot.fromDuration(monday10, 60);
    const b = TimeSlot.fromDuration(new Date("2026-09-07T11:00:00Z"), 60);
    expect(a.overlaps(b)).toBe(false);
  });

  it("calcula las horas de antelación", () => {
    const slot = TimeSlot.fromDuration(monday10, 60);
    const now = new Date("2026-09-06T10:00:00Z");
    expect(slot.hoursOfNoticeFrom(now)).toBe(24);
  });

  it("conserva la duración al mover la clase", () => {
    const slot = TimeSlot.fromDuration(monday10, 90);
    const moved = slot.movedTo(new Date("2026-09-08T16:00:00Z"));
    expect(moved.durationMinutes).toBe(90);
  });
});
