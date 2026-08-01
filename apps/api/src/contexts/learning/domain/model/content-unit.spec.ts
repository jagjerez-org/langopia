import { describe, expect, it } from "vitest";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { MembershipId, SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { ContentUnit } from "./content-unit.aggregate.js";
import { ContentUnitId, CourseId, ExerciseId } from "./identifiers.js";

const AHORA = new Date("2026-11-02T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const AUTOR = MembershipId.of("22222222-2222-4222-8222-222222222222");
const REVISOR = MembershipId.of("33333333-3333-4333-8333-333333333333");

function unidad(source: "ai_generated" | "uploaded" = "ai_generated") {
  return ContentUnit.draft({
    id: ContentUnitId.of("44444444-4444-4444-8444-444444444444"),
    schoolId: ESCUELA,
    code: "ES-B1-U07",
    language: "es",
    level: "B1",
    topic: "En la consulta del médico",
    skills: ["listening", "vocabulary"],
    source,
    primaryLocale: "es-ES",
    createdBy: AUTOR,
    now: AHORA,
  });
}

describe("ContentUnit", () => {
  it("una unidad generada por IA nace en revisión", () => {
    expect(unidad("ai_generated").status).toBe("in_review");
  });

  it("una unidad subida nace en borrador", () => {
    expect(unidad("uploaded").status).toBe("draft");
  });

  it("no se publica sin ejercicios", () => {
    const u = unidad();
    expect(() => u.publish({ reviewedBy: REVISOR, now: AHORA })).toThrow(/sin ejercicios/i);
  });

  it("se publica con ejercicios y revisor, y emite el evento", () => {
    const u = unidad();
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.pullDomainEvents();
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    expect(u.status).toBe("published");
    expect(u.reviewedBy!.value).toBe(REVISOR.value);
    expect(u.pullDomainEvents()[0]!.eventName).toBe("learning.content_unit.published");
  });

  it("una unidad archivada no vuelve atrás", () => {
    const u = unidad();
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    u.archive({ now: AHORA });
    expect(() => u.publish({ reviewedBy: REVISOR, now: AHORA })).toThrow(/archivada/i);
  });

  it("no se publica dos veces", () => {
    const u = unidad();
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    expect(() => u.publish({ reviewedBy: REVISOR, now: AHORA })).toThrow(/ya está publicada/i);
  });

  it("registra el coste de generación", () => {
    const u = unidad();
    u.recordGenerationCost({ costCents: 184, credits: 18 });
    expect(u.generationCostCents).toBe(184);
    expect(u.creditsSpent).toBe(18);
  });
});

// ─── Cobertura adicional, más allá de los 7 casos verbatim del brief ───────
//
// El brief lista dos reglas que los 7 casos de arriba no ejercitan: la firma
// del revisor (cubierta por el propio tipo — `reviewedBy` no admite null, así
// que «distinto de nadie» es un error de compilación, no de runtime) y que el
// nivel de la unidad coincida con el del curso al que se asocia. Esta última
// sí necesita prueba de comportamiento, y `submitForReview()` —listado entre
// los métodos que produce el agregado— tampoco tenía caso propio.

describe("ContentUnit — nivel del curso asociado", () => {
  const CURSO = CourseId.of("66666666-6666-4666-8666-666666666666");

  it("rechaza asociarse a un curso de otro nivel", () => {
    expect(() =>
      ContentUnit.draft({
        id: ContentUnitId.of("44444444-4444-4444-8444-444444444444"),
        schoolId: ESCUELA,
        code: "ES-B1-U08",
        language: "es",
        level: "B1",
        topic: "En la consulta del médico",
        skills: ["listening"],
        source: "ai_generated",
        primaryLocale: "es-ES",
        createdBy: AUTOR,
        course: { id: CURSO, level: CefrLevel.A1 },
        now: AHORA,
      }),
    ).toThrow(/nivel/i);
  });

  it("se asocia sin problema a un curso del mismo nivel", () => {
    const u = ContentUnit.draft({
      id: ContentUnitId.of("44444444-4444-4444-8444-444444444444"),
      schoolId: ESCUELA,
      code: "ES-B1-U08",
      language: "es",
      level: "B1",
      topic: "En la consulta del médico",
      skills: ["listening"],
      source: "ai_generated",
      primaryLocale: "es-ES",
      createdBy: AUTOR,
      course: { id: CURSO, level: CefrLevel.B1 },
      now: AHORA,
    });
    expect(u.courseId!.value).toBe(CURSO.value);
  });
});

describe("ContentUnit.submitForReview()", () => {
  it("envía un borrador a revisión", () => {
    const u = unidad("uploaded");
    u.submitForReview();
    expect(u.status).toBe("in_review");
  });

  it("no envía a revisión algo que no está en borrador", () => {
    const u = unidad("ai_generated"); // nace en in_review
    expect(() => u.submitForReview()).toThrow(/borrador|revisión/i);
  });

  it("no envía a revisión una unidad archivada", () => {
    const u = unidad("uploaded");
    u.addExercise(ExerciseId.of("55555555-5555-4555-8555-555555555555"));
    u.publish({ reviewedBy: REVISOR, now: AHORA });
    u.archive({ now: AHORA });
    expect(() => u.submitForReview()).toThrow(/archivada/i);
  });
});
