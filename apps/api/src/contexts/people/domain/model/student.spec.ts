import { describe, expect, it } from "vitest";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { DateOfBirth } from "./date-of-birth.vo.js";
import { GuardianId, StudentId } from "./identifiers.js";
import { Student } from "./student.aggregate.js";

const AHORA = new Date("2026-07-25T12:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const MIEMBRO = MembershipId.of("22222222-2222-4222-8222-222222222222");
const TUTOR = MembershipId.of("33333333-3333-4333-8333-333333333333");

function alumno(edad: number) {
  const anio = 2026 - edad;
  return Student.enrol({
    id: StudentId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    membershipId: MIEMBRO,
    dateOfBirth: DateOfBirth.of(`${anio}-01-01`),
    nativeLanguage: "es",
    targetLanguage: "en",
    now: AHORA,
  });
}

describe("Student", () => {
  it("un adulto puede firmar su propio consentimiento", () => {
    const a = alumno(30);
    a.grantConsent({ kind: "recording", grantedBy: MIEMBRO, now: AHORA });
    expect(a.hasConsent("recording")).toBe(true);
  });

  it("un menor NO puede firmar su propio consentimiento", () => {
    const a = alumno(12);
    a.addGuardian({ id: GuardianId.of("55555555-5555-4555-8555-555555555555"), membershipId: TUTOR, relationship: "mother", canGiveConsent: true });
    expect(() => a.grantConsent({ kind: "recording", grantedBy: MIEMBRO, now: AHORA })).toThrow(
      /tutor legal/i,
    );
  });

  it("el consentimiento de un menor lo firma su tutor", () => {
    const a = alumno(12);
    a.addGuardian({ id: GuardianId.of("55555555-5555-4555-8555-555555555555"), membershipId: TUTOR, relationship: "mother", canGiveConsent: true });
    a.grantConsent({ kind: "recording", grantedBy: TUTOR, now: AHORA });
    expect(a.hasConsent("recording")).toBe(true);
  });

  it("un menor sin tutor no puede tener consentimientos", () => {
    const a = alumno(12);
    expect(() => a.grantConsent({ kind: "recording", grantedBy: TUTOR, now: AHORA })).toThrow(
      /no consta como tutor/i,
    );
  });

  it("retirar el consentimiento lo deja sin efecto", () => {
    const a = alumno(30);
    a.grantConsent({ kind: "recording", grantedBy: MIEMBRO, now: AHORA });
    a.pullDomainEvents();
    a.withdrawConsent({ kind: "recording", now: AHORA });
    expect(a.hasConsent("recording")).toBe(false);
    expect(a.pullDomainEvents()[0]).toMatchObject({
      eventName: "people.consent.withdrawn",
      schoolId: ESCUELA.value,
    });
  });

  it("dar de baja registra el motivo y emite el evento", () => {
    const a = alumno(30);
    a.pullDomainEvents();
    a.leave({ reason: "Cambio de horario laboral", now: AHORA });
    expect(a.status).toBe("left");
    expect(a.pullDomainEvents()[0]!.eventName).toBe("people.student.left");
  });

  it("no se puede dar de baja dos veces", () => {
    const a = alumno(30);
    a.leave({ reason: "x", now: AHORA });
    expect(() => a.leave({ reason: "y", now: AHORA })).toThrow(/ya está de baja/i);
  });

  it("un alumno pausado puede reactivarse", () => {
    const a = alumno(30);
    a.pause({ until: new Date("2026-09-01T00:00:00Z"), now: AHORA });
    expect(a.status).toBe("paused");
    a.resume({ now: AHORA });
    expect(a.status).toBe("active");
  });

  it("marca que necesita tutor si es menor", () => {
    expect(alumno(12).guardianRequired).toBe(true);
    expect(alumno(30).guardianRequired).toBe(false);
  });

  /* ─── Tarea 13: edición de la ficha ────────────────────────────────────── */

  it("corrige la fecha de nacimiento de un adulto que sigue siendo adulto", () => {
    const a = alumno(30);
    a.changeDateOfBirth({ dateOfBirth: DateOfBirth.of("1990-06-15"), now: AHORA });
    expect(a.dateOfBirth.value).toBe("1990-06-15");
    expect(a.guardianRequired).toBe(false);
  });

  it("rechaza la corrección si convierte a un adulto en menor sin tutor", () => {
    const a = alumno(30);
    expect(() =>
      a.changeDateOfBirth({ dateOfBirth: DateOfBirth.of("2015-01-01"), now: AHORA }),
    ).toThrow(/tutor legal/i);
    // La fecha original no se toca si el cambio se rechaza.
    expect(a.guardianRequired).toBe(false);
  });

  it("permite la corrección a menor si ya hay un tutor con capacidad de consentir", () => {
    const a = alumno(30);
    a.addGuardian({
      id: GuardianId.of("55555555-5555-4555-8555-555555555555"),
      membershipId: TUTOR,
      relationship: "mother",
      canGiveConsent: true,
    });
    a.changeDateOfBirth({ dateOfBirth: DateOfBirth.of("2015-01-01"), now: AHORA });
    expect(a.guardianRequired).toBe(true);
  });

  it("ajusta el nivel MCER a mano", () => {
    const a = alumno(30);
    expect(a.currentLevel).toBeNull();
    a.changeLevel("B1");
    expect(a.currentLevel).toBe("B1");
    a.changeLevel(null);
    expect(a.currentLevel).toBeNull();
  });

  it("un alumno de baja no se edita", () => {
    const a = alumno(30);
    a.leave({ reason: "x", now: AHORA });
    expect(() =>
      a.changeDateOfBirth({ dateOfBirth: DateOfBirth.of("1991-01-01"), now: AHORA }),
    ).toThrow(/ya está de baja/i);
    expect(() => a.changeLevel("B2")).toThrow(/ya está de baja/i);
  });
});
