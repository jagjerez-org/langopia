import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CefrLevel } from "../../../shared/domain/model/cefr-level.js";
import { Exam, ExamStatus, type ExamItem, type ExamSection } from "./exam.aggregate.js";
import { ExamId } from "./identifiers.js";

const AHORA = new Date("2026-07-27T09:00:00Z");
const MAÑANA = new Date("2026-07-28T09:00:00Z");
const AYER = new Date("2026-07-26T09:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const ALUMNO = "22222222-2222-4222-8222-222222222222";
const PROFESOR = "33333333-3333-4333-8333-333333333333";
const UNIDAD_1 = "44444444-4444-4444-8444-444444444444";
const UNIDAD_2 = "55555555-5555-4555-8555-555555555555";

function item(overrides: Partial<ExamItem> = {}): ExamItem {
  return {
    id: overrides.id ?? "item-1",
    sourceExerciseId: null,
    sourceContentUnitId: UNIDAD_1,
    type: "multiple_choice",
    skill: "grammar",
    level: "B1",
    prompt: { question: "¿Correcto?", options: ["a", "b"] },
    solution: { correct: 0 },
    rubricId: null,
    rubricCode: null,
    maxScore: 1,
    response: null,
    result: null,
    ...overrides,
  };
}

function section(overrides: Partial<ExamSection> = {}): ExamSection {
  return {
    skill: "grammar",
    durationMinutes: 20,
    items: [item()],
    ...overrides,
  };
}

function distribucionCompleta(): Record<string, number> {
  return { reading: 25, speaking: 25, writing: 25, grammar: 25 };
}

function examen(overrides: {
  kind?: "unit_exam" | "level_exam" | "mock_official";
  sourceUnits?: readonly { id: string; status: string }[];
  skillDistribution?: Record<string, number>;
  sections?: readonly ExamSection[];
  mockFramework?: string | null;
  practiceExercises?: readonly { type: string; prompt: Record<string, unknown> }[];
} = {}) {
  return Exam.generate({
    id: ExamId.of("66666666-6666-4666-8666-666666666666"),
    schoolId: ESCUELA,
    kind: overrides.kind ?? "unit_exam",
    studentProfileId: ALUMNO,
    title: "Examen B1 — unidades 1 y 2",
    language: "es",
    level: CefrLevel.B1,
    sourceUnits: overrides.sourceUnits ?? [
      { id: UNIDAD_1, status: "published" },
      { id: UNIDAD_2, status: "published" },
    ],
    skillDistribution: overrides.skillDistribution ?? distribucionCompleta(),
    sections: overrides.sections ?? [section()],
    durationMinutes: 90,
    mockFramework: overrides.mockFramework,
    practiceExercises: overrides.practiceExercises,
    now: AHORA,
  });
}

describe("Exam", () => {
  it("se genera desde unidades ya publicadas y nace en scheduled", () => {
    const e = examen();
    expect(e.status).toBe(ExamStatus.Scheduled);
    expect(e.sourceContentUnitIds).toEqual([UNIDAD_1, UNIDAD_2]);
    expect(e.pullDomainEvents()[0]!.eventName).toBe("assessment.exam.generated");
  });

  it("rechaza una unidad en borrador", () => {
    expect(() =>
      examen({
        sourceUnits: [
          { id: UNIDAD_1, status: "published" },
          { id: UNIDAD_2, status: "draft" },
        ],
      }),
    ).toThrow(/no está publicada/);
  });

  it("rechaza generar sin ninguna unidad de origen", () => {
    expect(() => examen({ sourceUnits: [] })).toThrow(/al menos una unidad/);
  });

  it("rechaza un reparto de destrezas que no suma 100", () => {
    expect(() =>
      examen({ skillDistribution: { reading: 25, speaking: 25, writing: 25, grammar: 10 } }),
    ).toThrow(/sumar 100/);
  });

  it("rechaza un examen sin ningún ítem", () => {
    expect(() => examen({ sections: [section({ items: [] })] })).toThrow(/ningún ítem/);
  });

  it("un mock_official sin marco real se rechaza", () => {
    expect(() => examen({ kind: "mock_official", mockFramework: null })).toThrow(/simula/);
  });

  it("acepta un mock_official con su marco real", () => {
    const e = examen({ kind: "mock_official", mockFramework: "DELE B1" });
    expect(e.mockFramework).toBe("DELE B1");
  });

  it("rechaza un ítem que es copia literal de un ejercicio de práctica", () => {
    const prompt = { question: "¿Correcto?", options: ["a", "b"] };
    expect(() =>
      examen({
        sections: [section({ items: [item({ prompt, sourceExerciseId: "ex-1" })] })],
        practiceExercises: [{ type: "multiple_choice", prompt }],
      }),
    ).toThrow(/copia literal/);
  });

  it("una variante distinta del mismo tipo no se rechaza", () => {
    const e = examen({
      sections: [
        section({
          items: [
            item({
              prompt: { question: "¿Y esto?", options: ["x", "y"] },
              sourceExerciseId: "ex-1",
            }),
          ],
        }),
      ],
      practiceExercises: [{ type: "multiple_choice", prompt: { question: "¿Correcto?", options: ["a", "b"] } }],
    });
    expect(e.status).toBe(ExamStatus.Scheduled);
  });

  it("se programa para una fecha futura", () => {
    const e = examen();
    e.schedule({ scheduledFor: MAÑANA, now: AHORA });
    expect(e.scheduledFor).toEqual(MAÑANA);
  });

  it("no se programa en el pasado", () => {
    const e = examen();
    expect(() => e.schedule({ scheduledFor: AYER, now: AHORA })).toThrow(/ya ha pasado/);
  });

  it("start() arranca el cronómetro y fija el plazo", () => {
    const e = examen();
    e.pullDomainEvents();
    e.start({ now: AHORA });
    expect(e.status).toBe(ExamStatus.InProgress);
    expect(e.deadlineAt).toEqual(new Date(AHORA.getTime() + 90 * 60_000));
    expect(e.pullDomainEvents()[0]!.eventName).toBe("assessment.exam.started");
  });

  it("no se puede empezar un examen que no está scheduled", () => {
    const e = examen();
    e.start({ now: AHORA });
    expect(() => e.start({ now: AHORA })).toThrow(/no admite «start»/);
  });

  it("submit() registra la respuesta de cada ítem y pasa a submitted", () => {
    const e = examen();
    e.start({ now: AHORA });
    e.pullDomainEvents();
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    expect(e.status).toBe(ExamStatus.Submitted);
    expect(e.sections[0]!.items[0]!.response).toEqual({ correct: 0 });
    expect(e.pullDomainEvents()[0]!.eventName).toBe("assessment.exam.submitted");
  });

  it("no se entrega un examen sin ninguna respuesta", () => {
    const e = examen();
    e.start({ now: AHORA });
    expect(() => e.submit({ responses: {}, now: AHORA })).toThrow(/ninguna respuesta/);
  });

  it("grade() agrega la nota de cada ítem y el desglose por destreza", () => {
    const e = examen({
      sections: [
        section({ skill: "grammar", items: [item({ id: "i1", skill: "grammar", maxScore: 2 })] }),
        section({
          skill: "writing",
          items: [
            item({
              id: "i2",
              type: "written_production",
              skill: "writing",
              solution: null,
              maxScore: 20,
              rubricId: "rubric-1",
            }),
          ],
        }),
      ],
    });
    e.start({ now: AHORA });
    e.submit({ responses: { i1: { correct: 0 }, i2: { text: "..." } }, now: AHORA });
    e.pullDomainEvents();

    e.grade({
      itemResults: {
        i1: { score: 2, feedback: "Correcto.", model: null, costCents: 0 },
        i2: { score: 16, feedback: "Buen texto.", model: "claude-opus-5", costCents: 40 },
      },
      now: AHORA,
    });

    expect(e.status).toBe(ExamStatus.AiGraded);
    expect(e.aiScore).toBe(18);
    expect(e.score).toBe(18);
    expect(e.maxScore).toBe(22);
    expect(e.skillBreakdown).toEqual({ grammar: 1, writing: 0.8 });
    expect(e.aiCostCents).toBe(40);
    expect(e.pullDomainEvents()[0]!.eventName).toBe("assessment.exam.ai_graded");
  });

  it("la nota sin firmar del profesor no cuenta para el expediente", () => {
    const e = examen();
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    expect(e.countsForRecord).toBe(false);

    e.grade({ itemResults: { "item-1": { score: 1, feedback: "Correcto.", model: null, costCents: 0 } }, now: AHORA });
    expect(e.countsForRecord).toBe(false);

    e.validate({ score: 1, membershipId: PROFESOR, now: AHORA });
    expect(e.countsForRecord).toBe(true);
  });

  it("el profesor puede validar directamente desde submitted, sin pasar por ai_graded", () => {
    const e = examen();
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    e.validate({ score: 1, membershipId: PROFESOR, now: AHORA });
    expect(e.status).toBe(ExamStatus.TeacherValidated);
  });

  it("el profesor puede subir o bajar la nota de la IA al firmar", () => {
    const e = examen();
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    e.grade({ itemResults: { "item-1": { score: 1, feedback: "x", model: null, costCents: 0 } }, now: AHORA });
    e.validate({ score: 0, membershipId: PROFESOR, now: AHORA });
    expect(e.score).toBe(0);
    expect(e.aiScore).toBe(1);
  });

  it("aprobar un examen de nivel propone subir de nivel MCER, sin decidirlo", () => {
    const e = examen({
      kind: "level_exam",
      sections: [section({ items: [item({ maxScore: 10 })] })],
    });
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    e.pullDomainEvents();

    e.validate({ score: 8, membershipId: PROFESOR, now: AHORA });

    expect(e.proposedLevelUpgrade).toBe(CefrLevel.B2);
    const events = e.pullDomainEvents().map((ev) => ev.eventName);
    expect(events).toContain("assessment.exam.level_upgrade_proposed");
    expect(events).toContain("assessment.exam.teacher_validated");
  });

  it("un examen de nivel que no aprueba no propone nada", () => {
    const e = examen({
      kind: "level_exam",
      sections: [section({ items: [item({ maxScore: 10 })] })],
    });
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    e.validate({ score: 3, membershipId: PROFESOR, now: AHORA });
    expect(e.proposedLevelUpgrade).toBeNull();
  });

  it("un unit_exam aprobado no propone ninguna subida de nivel", () => {
    const e = examen({ sections: [section({ items: [item({ maxScore: 10 })] })] });
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    e.validate({ score: 10, membershipId: PROFESOR, now: AHORA });
    expect(e.proposedLevelUpgrade).toBeNull();
  });

  it("rechaza una puntuación negativa al validar", () => {
    const e = examen();
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    expect(() => e.validate({ score: -1, membershipId: PROFESOR, now: AHORA })).toThrow(/no negativo/i);
  });

  it("rehydrate() reconstruye el examen tal cual, sin emitir eventos", () => {
    const e = examen();
    const rehydrated = Exam.rehydrate({
      id: e.id,
      schoolId: e.schoolId,
      kind: e.kind,
      studentProfileId: e.studentProfileId,
      title: e.title,
      language: e.language,
      level: e.level,
      sourceContentUnitIds: e.sourceContentUnitIds,
      skillDistribution: e.skillDistribution as Record<string, number>,
      sections: e.sections as ExamSection[],
      durationMinutes: e.durationMinutes,
      mockFramework: e.mockFramework,
      status: e.status,
      scheduledFor: e.scheduledFor,
      startedAt: e.startedAt,
      submittedAt: e.submittedAt,
      score: e.score,
      aiScore: e.aiScore,
      aiFeedback: e.aiFeedback,
      aiModel: e.aiModel,
      aiCostCents: e.aiCostCents,
      validatedByMembershipId: e.validatedByMembershipId,
      validatedAt: e.validatedAt,
      proposedLevelUpgrade: e.proposedLevelUpgrade,
      createdAt: e.createdAt,
    });
    expect(rehydrated.status).toBe(ExamStatus.Scheduled);
    expect(rehydrated.pullDomainEvents()).toHaveLength(0);
  });

  it("recomputeSkillBreakdown() recupera el desglose tras un rehydrate(), que no lo trae por sí solo", () => {
    const e = examen({ sections: [section({ items: [item({ maxScore: 2 })] })] });
    e.start({ now: AHORA });
    e.submit({ responses: { "item-1": { correct: 0 } }, now: AHORA });
    e.grade({ itemResults: { "item-1": { score: 2, feedback: "x", model: null, costCents: 0 } }, now: AHORA });
    expect(e.skillBreakdown).toEqual({ grammar: 1 });

    // `rehydrate()` no recalcula nada por sí solo: es responsabilidad de
    // quien lo llama (el mapeador de persistencia) invocar
    // `recomputeSkillBreakdown()` si necesita leer el desglose de un examen
    // ya corregido — de lo contrario, volver a guardarlo (p. ej. al validar)
    // persistiría un desglose vacío encima del ya calculado.
    const rehydrated = Exam.rehydrate({
      id: e.id,
      schoolId: e.schoolId,
      kind: e.kind,
      studentProfileId: e.studentProfileId,
      title: e.title,
      language: e.language,
      level: e.level,
      sourceContentUnitIds: e.sourceContentUnitIds,
      skillDistribution: e.skillDistribution as Record<string, number>,
      sections: e.sections as ExamSection[],
      durationMinutes: e.durationMinutes,
      mockFramework: e.mockFramework,
      status: e.status,
      scheduledFor: e.scheduledFor,
      startedAt: e.startedAt,
      submittedAt: e.submittedAt,
      score: e.score,
      aiScore: e.aiScore,
      aiFeedback: e.aiFeedback,
      aiModel: e.aiModel,
      aiCostCents: e.aiCostCents,
      validatedByMembershipId: e.validatedByMembershipId,
      validatedAt: e.validatedAt,
      proposedLevelUpgrade: e.proposedLevelUpgrade,
      createdAt: e.createdAt,
    });
    expect(rehydrated.skillBreakdown).toEqual({});

    rehydrated.recomputeSkillBreakdown();
    expect(rehydrated.skillBreakdown).toEqual({ grammar: 1 });
  });
});
