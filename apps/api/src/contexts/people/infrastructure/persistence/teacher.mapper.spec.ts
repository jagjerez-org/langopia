import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { HourlyRate } from "../../domain/model/hourly-rate.vo.js";
import { TeacherId } from "../../domain/model/identifiers.js";
import { Teacher } from "../../domain/model/teacher.aggregate.js";
import { WeeklyAvailability } from "../../domain/model/weekly-availability.vo.js";
import { TeacherMapper } from "./teacher.mapper.js";

const AHORA = new Date("2026-07-25T12:00:00Z");

describe("TeacherMapper", () => {
  it("conserva el estado al ir y volver, con disponibilidad incluida", () => {
    const original = Teacher.hire({
      id: TeacherId.of("44444444-4444-4444-8444-444444444444"),
      schoolId: SchoolId.of("11111111-1111-4111-8111-111111111111"),
      membershipId: MembershipId.of("22222222-2222-4222-8222-222222222222"),
      hourlyRate: HourlyRate.of("professional", 2800),
      contractedHoursPerWeek: 24,
      hiredAt: new Date("2024-01-01T00:00:00Z"),
    });
    original.setAvailability(
      WeeklyAvailability.of([
        { weekday: 1, startMinute: 9 * 60, endMinute: 14 * 60 },
        { weekday: 3, startMinute: 16 * 60, endMinute: 21 * 60 },
      ]),
    );

    const filas = TeacherMapper.toPersistence(original);
    const vuelta = TeacherMapper.toDomain(filas.teacher, filas.availability);

    expect(vuelta.id.value).toBe(original.id.value);
    expect(vuelta.status).toBe("active");
    expect(vuelta.hourlyRate.tier).toBe("professional");
    expect(vuelta.hourlyRate.cents).toBe(2800);
    expect(vuelta.contractedHoursPerWeek).toBe(24);
    expect(vuelta.hiredAt.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(vuelta.availability.slots).toEqual(original.availability.slots);
    // La rehidratación no reproduce eventos: lo que ya pasó no vuelve a pasar.
    expect(vuelta.hasUncommittedEvents).toBe(false);
  });

  it("conserva el motivo de baja de un profesor que se fue", () => {
    const original = Teacher.hire({
      id: TeacherId.of("55555555-5555-4555-8555-555555555555"),
      schoolId: SchoolId.of("11111111-1111-4111-8111-111111111111"),
      membershipId: MembershipId.of("33333333-3333-4333-8333-333333333333"),
      hourlyRate: HourlyRate.of("community", 1200),
      contractedHoursPerWeek: 12,
      hiredAt: new Date("2023-01-01T00:00:00Z"),
    });
    original.release({ reason: "Traslado a otra ciudad", now: AHORA });

    const filas = TeacherMapper.toPersistence(original);
    const vuelta = TeacherMapper.toDomain(filas.teacher, filas.availability);

    expect(vuelta.status).toBe("left");
    expect(vuelta.leftReason).toBe("Traslado a otra ciudad");
  });
});
