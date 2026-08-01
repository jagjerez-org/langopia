import { describe, expect, it } from "vitest";
import type { ContentUnitDetail, LearningReadModel } from "../../ports/learning-read-model.port.js";
import { GetUnitDetailHandler, GetUnitDetailQuery } from "./get-unit-detail.handler.js";

const UNIT_ID = "11111111-1111-4111-8111-111111111111";

const DETALLE: ContentUnitDetail = {
  contentUnitId: UNIT_ID,
  code: "ES-B1-U07",
  language: "es",
  level: "B1",
  topic: "En la consulta del médico",
  skills: ["listening", "vocabulary"],
  status: "in_review",
  source: "ai_generated",
  primaryLocale: "es-ES",
  creditsSpent: 23,
  generationCostCents: 232,
  createdAt: "2026-07-27T10:00:00.000Z",
  reviewedAt: null,
  publishedAt: null,
  title: "En la consulta del médico",
  description: "Vocabulario y expresiones para una cita médica.",
  body: "Cuerpo de la unidad...",
  assets: [],
  exercises: [
    {
      exerciseId: "22222222-2222-4222-8222-222222222222",
      position: 1,
      type: "multiple_choice",
      skill: "grammar",
      prompt: { question: "¿Qué duele?", options: ["cabeza", "pie"] },
      solution: { correct: 0 },
      maxScore: 1,
      requiresTeacherValidation: false,
    },
  ],
};

function fakeReadModel(detail: ContentUnitDetail | null): LearningReadModel {
  return {
    listUnits: async () => {
      throw new Error("no usado en esta prueba");
    },
    listPublishTargets: async () => {
      throw new Error("no usado en esta prueba");
    },
    getUnitDetail: async (id) => (id === UNIT_ID ? detail : null),
    getGenerationEstimate: async () => {
      throw new Error("no usado en esta prueba");
    },
  };
}

describe("GetUnitDetailHandler", () => {
  it("devuelve la ficha completa, con sus ejercicios", async () => {
    const handler = new GetUnitDetailHandler(fakeReadModel(DETALLE));

    const result = await handler.execute(new GetUnitDetailQuery({ contentUnitId: UNIT_ID }));

    expect(result).toEqual(DETALLE);
  });

  it("una unidad que no existe (o que RLS oculta) se rechaza con not_found, no con null", async () => {
    const handler = new GetUnitDetailHandler(fakeReadModel(null));

    await expect(
      handler.execute(new GetUnitDetailQuery({ contentUnitId: UNIT_ID })),
    ).rejects.toThrow();
  });
});
