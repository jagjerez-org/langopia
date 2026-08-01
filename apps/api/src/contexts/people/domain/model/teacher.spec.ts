import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { HourlyRate } from "./hourly-rate.vo.js";
import { TeacherId } from "./identifiers.js";
import { Teacher } from "./teacher.aggregate.js";
import { WeeklyAvailability } from "./weekly-availability.vo.js";

const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const MIEMBRO = MembershipId.of("22222222-2222-4222-8222-222222222222");
const HIRED_AT = new Date("2024-01-01T00:00:00Z");

function contratar(contractedHoursPerWeek: number) {
  return Teacher.hire({
    id: TeacherId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    membershipId: MIEMBRO,
    hourlyRate: HourlyRate.of("professional", 2800),
    contractedHoursPerWeek,
    hiredAt: HIRED_AT,
  });
}

describe("Teacher", () => {
  it("se contrata activo, con la tarifa y las horas dadas", () => {
    const profesor = contratar(24);
    expect(profesor.status).toBe("active");
    expect(profesor.contractedHoursPerWeek).toBe(24);
    expect(profesor.hourlyRate.cents).toBe(2800);
  });

  it("acepta el límite inferior de una hora contratada a la semana", () => {
    expect(contratar(1).contractedHoursPerWeek).toBe(1);
  });

  it("acepta el límite superior de 60 horas contratadas a la semana", () => {
    expect(contratar(60).contractedHoursPerWeek).toBe(60);
  });

  it("rechaza menos de una hora contratada a la semana", () => {
    expect(() => contratar(0)).toThrow(/horas contratadas/i);
  });

  it("rechaza más de 60 horas contratadas a la semana", () => {
    expect(() => contratar(61)).toThrow(/horas contratadas/i);
  });

  it("se contrata sin disponibilidad declarada todavía", () => {
    expect(contratar(20).availability.slots).toHaveLength(0);
  });

  it("cambiar la disponibilidad sustituye la anterior, no la combina", () => {
    const profesor = contratar(20);
    profesor.setAvailability(
      WeeklyAvailability.of([{ weekday: 1, startMinute: 9 * 60, endMinute: 14 * 60 }]),
    );
    profesor.setAvailability(
      WeeklyAvailability.of([{ weekday: 3, startMinute: 16 * 60, endMinute: 20 * 60 }]),
    );
    expect(profesor.availability.slots).toEqual([
      { weekday: 3, startMinute: 16 * 60, endMinute: 20 * 60 },
    ]);
  });

  it("dar de baja registra el motivo", () => {
    const profesor = contratar(20);
    profesor.release({ reason: "Traslado a otra ciudad", now: HIRED_AT });
    expect(profesor.status).toBe("left");
    expect(profesor.leftReason).toBe("Traslado a otra ciudad");
  });

  it("no se puede dar de baja dos veces", () => {
    const profesor = contratar(20);
    profesor.release({ reason: "x", now: HIRED_AT });
    expect(() => profesor.release({ reason: "y", now: HIRED_AT })).toThrow(/ya está de baja/i);
  });

  /* ─── Tarea 13: edición de la ficha ────────────────────────────────────── */

  it("cambia solo el importe dentro del mismo tramo", () => {
    const profesor = contratar(20);
    profesor.changeHourlyRate({ hourlyRateCents: 3200 });
    expect(profesor.hourlyRate.tier).toBe("professional");
    expect(profesor.hourlyRate.cents).toBe(3200);
  });

  it("cambia de tramo cuando el importe sigue siendo válido en el nuevo", () => {
    const profesor = contratar(20); // professional, 2800
    profesor.changeHourlyRate({ tier: "specialist", hourlyRateCents: 3200 });
    expect(profesor.hourlyRate.tier).toBe("specialist");
    expect(profesor.hourlyRate.cents).toBe(3200);
  });

  it("rechaza el tramo nuevo si el importe ya no es válido en él", () => {
    const profesor = contratar(20); // professional, 2800 €/h en céntimos
    expect(() => profesor.changeHourlyRate({ tier: "community" })).toThrow(/tramo/i);
    // El cambio rechazado no deja el agregado a medias.
    expect(profesor.hourlyRate.tier).toBe("professional");
    expect(profesor.hourlyRate.cents).toBe(2800);
  });

  it("un profesor de baja no se edita", () => {
    const profesor = contratar(20);
    profesor.release({ reason: "x", now: HIRED_AT });
    expect(() => profesor.changeHourlyRate({ hourlyRateCents: 3000 })).toThrow(/ya está de baja/i);
  });
});
