import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Attempt, AttemptStatus } from "./attempt.aggregate.js";
import { AttemptId, ExerciseId } from "./identifiers.js";

const AHORA = new Date("2026-07-27T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const EJERCICIO = ExerciseId.of("22222222-2222-4222-8222-222222222222");
const ALUMNO = "33333333-3333-4333-8333-333333333333";
const PROFESOR = "44444444-4444-4444-8444-444444444444";

function intento(opts: { attemptNumber?: number; maxAttempts?: number; response?: Record<string, unknown> } = {}) {
  return Attempt.submit({
    id: AttemptId.of("55555555-5555-4555-8555-555555555555"),
    schoolId: ESCUELA,
    exerciseId: EJERCICIO,
    studentProfileId: ALUMNO,
    attemptNumber: opts.attemptNumber ?? 1,
    maxAttempts: opts.maxAttempts ?? 3,
    response: opts.response ?? { correct: 1 },
    now: AHORA,
  });
}

describe("Attempt", () => {
  it("un intento nuevo empieza en submitted y emite el evento", () => {
    const a = intento();
    expect(a.status).toBe(AttemptStatus.Submitted);
    expect(a.pullDomainEvents()[0]!.eventName).toBe("assessment.attempt.submitted");
  });

  it("supera el tope de reintentos", () => {
    expect(() => intento({ attemptNumber: 4, maxAttempts: 3 })).toThrow(/máximo 3/);
  });

  it("un intento sin respuesta se rechaza", () => {
    expect(() => intento({ response: {} })).toThrow(/ninguna respuesta/i);
  });

  it("la IA corrige un intento submitted y pasa a ai_graded", () => {
    const a = intento();
    a.pullDomainEvents();
    a.gradeWithAi({ score: 1, feedback: "Correcto.", model: "auto", costCents: 0, now: AHORA });
    expect(a.status).toBe(AttemptStatus.AiGraded);
    expect(a.aiScore).toBe(1);
    expect(a.pullDomainEvents()[0]!.eventName).toBe("assessment.attempt.ai_graded");
  });

  it("no se puede corregir con IA un intento que ya no está submitted", () => {
    const a = intento();
    a.gradeWithAi({ score: 1, feedback: "Correcto.", model: "auto", costCents: 0, now: AHORA });
    expect(() =>
      a.gradeWithAi({ score: 1, feedback: "Correcto.", model: "auto", costCents: 0, now: AHORA }),
    ).toThrow(/no admite «gradeWithAi»/);
  });

  it("rechaza una puntuación negativa", () => {
    const a = intento();
    expect(() =>
      a.gradeWithAi({ score: -1, feedback: "x", model: "auto", costCents: 0, now: AHORA }),
    ).toThrow(/no negativo/i);
  });

  it("el profesor valida desde ai_graded y queda registrado quién y cuándo", () => {
    const a = intento();
    a.gradeWithAi({ score: 1, feedback: "Correcto.", model: "auto", costCents: 0, now: AHORA });
    a.pullDomainEvents();
    a.validate({ teacherScore: 1, membershipId: PROFESOR, now: AHORA });
    expect(a.status).toBe(AttemptStatus.TeacherValidated);
    expect(a.validatedByMembershipId).toBe(PROFESOR);
    expect(a.validatedAt).toEqual(AHORA);
    expect(a.pullDomainEvents()[0]!.eventName).toBe("assessment.attempt.teacher_validated");
  });

  it("el profesor puede validar directamente desde submitted, sin pasar por ai_graded", () => {
    const a = intento();
    a.validate({ teacherScore: 1, membershipId: PROFESOR, now: AHORA });
    expect(a.status).toBe(AttemptStatus.TeacherValidated);
  });

  it("el profesor puede subir o bajar la nota de la IA", () => {
    const subida = intento();
    subida.gradeWithAi({ score: 1, feedback: "x", model: "auto", costCents: 0, now: AHORA });
    subida.validate({ teacherScore: 3, membershipId: PROFESOR, now: AHORA });
    expect(subida.teacherScore).toBe(3);
    expect(subida.aiScore).toBe(1);

    const bajada = intento({ response: { correct: 1 } });
    bajada.gradeWithAi({ score: 3, feedback: "x", model: "auto", costCents: 0, now: AHORA });
    bajada.validate({ teacherScore: 0, membershipId: PROFESOR, now: AHORA });
    expect(bajada.teacherScore).toBe(0);
  });

  it("solo teacher_validated cuenta para el expediente", () => {
    const a = intento();
    expect(a.countsForRecord).toBe(false);
    a.gradeWithAi({ score: 1, feedback: "x", model: "auto", costCents: 0, now: AHORA });
    expect(a.countsForRecord).toBe(false);
    a.validate({ teacherScore: 1, membershipId: PROFESOR, now: AHORA });
    expect(a.countsForRecord).toBe(true);
  });

  it("devolver el intento lo pone en returned sin perder la nota de la IA", () => {
    const a = intento();
    a.gradeWithAi({ score: 0, feedback: "Muy corto.", model: "auto", costCents: 0, now: AHORA });
    a.pullDomainEvents();
    a.returnToStudent({ teacherFeedback: "Vuelve a intentarlo.", membershipId: PROFESOR, now: AHORA });
    expect(a.status).toBe(AttemptStatus.Returned);
    expect(a.aiScore).toBe(0);
    expect(a.teacherFeedback).toBe("Vuelve a intentarlo.");
    expect(a.validatedByMembershipId).toBe(PROFESOR);
    expect(a.pullDomainEvents()[0]!.eventName).toBe("assessment.attempt.returned_to_student");
  });

  it("no se puede devolver un intento ya validado por el profesor", () => {
    const a = intento();
    a.validate({ teacherScore: 1, membershipId: PROFESOR, now: AHORA });
    expect(() =>
      a.returnToStudent({ teacherFeedback: "x", membershipId: PROFESOR, now: AHORA }),
    ).toThrow(/no admite «returnToStudent»/);
  });
});
