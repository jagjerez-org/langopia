import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Evaluation } from "./evaluation.aggregate.js";
import { EvaluationId } from "./identifiers.js";

const AHORA = new Date("2026-09-30T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");

function valoracion(rating = 4, periodEnd = new Date("2026-09-29T00:00:00Z")) {
  return Evaluation.write({
    id: EvaluationId.of("22222222-2222-4222-8222-222222222222"),
    schoolId: ESCUELA,
    teacherProfileId: "33333333-3333-4333-8333-333333333333",
    studentProfileId: "44444444-4444-4444-8444-444444444444",
    periodStart: new Date("2026-09-01T00:00:00Z"),
    periodEnd,
    progressRating: rating,
    strengths: "Muy buena pronunciación.",
    improvements: "Ampliar vocabulario laboral.",
    nextSteps: "Pasar al grupo A2 en octubre.",
    studentIsMinor: false,
    now: AHORA,
  });
}

describe("Evaluation", () => {
  it("registra la valoración y emite el evento", () => {
    const e = valoracion();
    expect(e.progressRating).toBe(4);
    expect(e.pullDomainEvents()[0]!.eventName).toBe("assessment.student.evaluated");
  });

  it("rechaza una puntuación fuera de 1 a 5", () => {
    expect(() => valoracion(6)).toThrow(/entre 1 y 5/);
    expect(() => valoracion(0)).toThrow(/entre 1 y 5/);
  });

  it("rechaza un periodo que termina en el futuro", () => {
    expect(() => valoracion(4, new Date("2026-12-01T00:00:00Z"))).toThrow(/futuro/i);
  });

  it("es visible para el tutor por defecto si el alumno es menor", () => {
    const e = Evaluation.write({
      id: EvaluationId.of("22222222-2222-4222-8222-222222222222"),
      schoolId: ESCUELA,
      teacherProfileId: "33333333-3333-4333-8333-333333333333",
      studentProfileId: "44444444-4444-4444-8444-444444444444",
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-09-29T00:00:00Z"),
      progressRating: 3,
      studentIsMinor: true,
      now: AHORA,
    });
    expect(e.visibleToGuardian).toBe(true);
  });

  it("se puede revisar dentro de los 7 días", () => {
    const e = valoracion();
    e.revise({ progressRating: 5, strengths: "Corregido", now: new Date("2026-10-03T10:00:00Z") });
    expect(e.progressRating).toBe(5);
  });

  it("no se puede revisar pasados 7 días", () => {
    const e = valoracion();
    expect(() =>
      e.revise({ progressRating: 5, now: new Date("2026-10-15T10:00:00Z") }),
    ).toThrow(/congelada/i);
  });

  it("detecta solape de periodos", () => {
    const a = valoracion();
    expect(
      a.overlapsWith({
        periodStart: new Date("2026-09-15T00:00:00Z"),
        periodEnd: new Date("2026-10-15T00:00:00Z"),
      }),
    ).toBe(true);
  });

  it("no es visible para el tutor tras ocultarla explícitamente", () => {
    const e = Evaluation.write({
      id: EvaluationId.of("22222222-2222-4222-8222-222222222222"),
      schoolId: ESCUELA,
      teacherProfileId: "33333333-3333-4333-8333-333333333333",
      studentProfileId: "44444444-4444-4444-8444-444444444444",
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-09-29T00:00:00Z"),
      progressRating: 3,
      studentIsMinor: true,
      now: AHORA,
    });
    e.hideFromGuardian();
    expect(e.visibleToGuardian).toBe(false);
  });

  it("no detecta solape cuando los periodos no se tocan", () => {
    const a = valoracion();
    expect(
      a.overlapsWith({
        periodStart: new Date("2026-10-01T00:00:00Z"),
        periodEnd: new Date("2026-10-15T00:00:00Z"),
      }),
    ).toBe(false);
  });
});
