import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "../../domain/model/date-of-birth.vo.js";
import { GuardianId, StudentId } from "../../domain/model/identifiers.js";
import { Student } from "../../domain/model/student.aggregate.js";
import { StudentMapper } from "./student.mapper.js";

const AHORA = new Date("2026-07-25T12:00:00Z");

describe("StudentMapper", () => {
  it("conserva el estado al ir y volver", () => {
    const original = Student.enrol({
      id: StudentId.of("44444444-4444-4444-8444-444444444444"),
      schoolId: SchoolId.of("11111111-1111-4111-8111-111111111111"),
      membershipId: MembershipId.of("22222222-2222-4222-8222-222222222222"),
      dateOfBirth: DateOfBirth.of("2014-01-01"),
      nativeLanguage: "es",
      targetLanguage: "en",
      now: AHORA,
    });
    original.addGuardian({
      id: GuardianId.of("55555555-5555-4555-8555-555555555555"),
      membershipId: MembershipId.of("33333333-3333-4333-8333-333333333333"),
      relationship: "mother",
      canGiveConsent: true,
    });
    original.grantConsent({
      kind: "recording",
      grantedBy: MembershipId.of("33333333-3333-4333-8333-333333333333"),
      now: AHORA,
    });
    original.changeLevel("B1");

    const filas = StudentMapper.toPersistence(original);
    const vuelta = StudentMapper.toDomain(filas.student, filas.guardians, filas.consents, AHORA);

    expect(vuelta.id.value).toBe(original.id.value);
    expect(vuelta.guardianRequired).toBe(true);
    expect(vuelta.hasConsent("recording")).toBe(true);
    expect(vuelta.guardians).toHaveLength(1);
    expect(vuelta.currentLevel).toBe("B1");
    // La rehidratación no reproduce eventos: lo que ya pasó no vuelve a pasar.
    expect(vuelta.hasUncommittedEvents).toBe(false);
  });
});
