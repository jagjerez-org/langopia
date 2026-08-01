import { describe, expect, it } from "vitest";
import { CancellationPolicy } from "./cancellation-policy.js";
import { CancelingParty } from "./session-status.js";
import { TimeSlot } from "./time-slot.vo.js";

describe("CancellationPolicy", () => {
  const policy = CancellationPolicy.default(); // 24 h
  const slot = TimeSlot.fromDuration(new Date("2026-09-07T10:00:00Z"), 60);

  it("el alumno tiene devolución si avisa con la antelación mínima", () => {
    const twoDaysBefore = new Date("2026-09-05T10:00:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.Student, slot, canceledAt: twoDaysBefore })).toBe(true);
  });

  it("el alumno NO tiene devolución si avisa tarde", () => {
    const threeHoursBefore = new Date("2026-09-07T07:00:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.Student, slot, canceledAt: threeHoursBefore })).toBe(false);
  });

  it("en el límite exacto de 24 h sí hay devolución", () => {
    const exactlyAtLimit = new Date("2026-09-06T10:00:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.Student, slot, canceledAt: exactlyAtLimit })).toBe(true);
  });

  it("si cancela la escuela SIEMPRE hay devolución, avise cuando avise", () => {
    const fiveMinutesBefore = new Date("2026-09-07T09:55:00Z");
    expect(policy.refundDueFor({ party: CancelingParty.School, slot, canceledAt: fiveMinutesBefore })).toBe(true);
  });

  it("rechaza una antelación negativa", () => {
    expect(() => CancellationPolicy.of(-1)).toThrow(/no negativo/);
  });

  it("rechaza una antelación de más de una semana", () => {
    expect(() => CancellationPolicy.of(200)).toThrow(/una semana/);
  });
});
