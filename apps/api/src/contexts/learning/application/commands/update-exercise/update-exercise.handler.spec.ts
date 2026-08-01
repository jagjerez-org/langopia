import { describe, expect, it } from "vitest";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { MembershipId, SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { ContentUnit } from "../../../domain/model/content-unit.aggregate.js";
import { ContentUnitId, ExerciseId } from "../../../domain/model/identifiers.js";
import type { ContentUnitRepository } from "../../../domain/ports/content-unit.repository.port.js";
import type { ExerciseRecord, ExerciseRepositoryPort } from "../../../domain/ports/exercise.repository.port.js";
import { UpdateExerciseCommand } from "./update-exercise.command.js";
import { UpdateExerciseHandler } from "./update-exercise.handler.js";

const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const AUTOR = MembershipId.of("22222222-2222-4222-8222-222222222222");
const UNIT_ID = ContentUnitId.of("33333333-3333-4333-8333-333333333333");
const EXERCISE_ID = ExerciseId.of("44444444-4444-4444-8444-444444444444");
const OTRA_UNIDAD_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-07-27T10:00:00Z");

function unidad(withExercise = true): ContentUnit {
  const unit = ContentUnit.draft({
    id: UNIT_ID,
    schoolId: ESCUELA,
    code: "ES-B1-U07",
    language: "es",
    level: "B1",
    topic: "En la consulta del médico",
    skills: ["listening"],
    source: "ai_generated",
    primaryLocale: "es-ES",
    createdBy: AUTOR,
    now: NOW,
  });
  if (withExercise) unit.addExercise(EXERCISE_ID);
  return unit;
}

function unidadArchivada(): ContentUnit {
  const unit = unidad();
  unit.archive({ now: NOW });
  return unit;
}

function fakeContentUnitRepository(initial: ContentUnit | null): ContentUnitRepository {
  return {
    save: async () => undefined,
    saveTranslation: async () => undefined,
    addExercises: async () => undefined,
    findById: async (id) => (initial && initial.id.value === id.value ? initial : null),
    findRubricIdByCode: async () => null,
    findExerciseSrsInfo: async () => null,
  };
}

function fakeExerciseRepository(record: ExerciseRecord | null) {
  const updates: { exerciseId: string; prompt: Record<string, unknown>; solution?: Record<string, unknown> | null }[] = [];
  const repository: ExerciseRepositoryPort = {
    findById: async (id) => (record && record.id === id.value ? record : null),
    updateContent: async (id, params) => {
      updates.push({ exerciseId: id.value, ...params });
    },
  };
  return { repository, updates };
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

describe("UpdateExerciseHandler", () => {
  it("revalida contra el esquema del tipo y persiste el contenido editado", async () => {
    const { repository: exercises, updates } = fakeExerciseRepository({
      id: EXERCISE_ID.value,
      contentUnitId: UNIT_ID.value,
      type: "multiple_choice",
    });
    const handler = new UpdateExerciseHandler(fakeContentUnitRepository(unidad()), exercises, fakeUow());

    const result = await handler.execute(
      new UpdateExerciseCommand({
        contentUnitId: UNIT_ID.value,
        exerciseId: EXERCISE_ID.value,
        prompt: { question: "¿Dónde te duele?", options: ["la cabeza", "el pie"] },
        solution: { correct: 0 },
      }),
    );

    expect(result.exerciseId).toBe(EXERCISE_ID.value);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.prompt).toEqual({ question: "¿Dónde te duele?", options: ["la cabeza", "el pie"] });
  });

  it("rechaza un contenido que no cumple el esquema del tipo, sin llegar a persistir", async () => {
    const { repository: exercises, updates } = fakeExerciseRepository({
      id: EXERCISE_ID.value,
      contentUnitId: UNIT_ID.value,
      type: "multiple_choice",
    });
    const handler = new UpdateExerciseHandler(fakeContentUnitRepository(unidad()), exercises, fakeUow());

    await expect(
      handler.execute(
        new UpdateExerciseCommand({
          contentUnitId: UNIT_ID.value,
          exerciseId: EXERCISE_ID.value,
          // `correct` fuera de rango: solo hay dos opciones.
          prompt: { question: "¿Dónde te duele?", options: ["la cabeza", "el pie"] },
          solution: { correct: 5 },
        }),
      ),
    ).rejects.toThrow(/fuera de rango/i);
    expect(updates).toHaveLength(0);
  });

  it("no se puede editar un ejercicio de una unidad archivada", async () => {
    const { repository: exercises } = fakeExerciseRepository({
      id: EXERCISE_ID.value,
      contentUnitId: UNIT_ID.value,
      type: "multiple_choice",
    });
    const handler = new UpdateExerciseHandler(fakeContentUnitRepository(unidadArchivada()), exercises, fakeUow());

    await expect(
      handler.execute(
        new UpdateExerciseCommand({
          contentUnitId: UNIT_ID.value,
          exerciseId: EXERCISE_ID.value,
          prompt: { question: "¿Dónde te duele?", options: ["la cabeza", "el pie"] },
          solution: { correct: 0 },
        }),
      ),
    ).rejects.toThrow(/archivada/i);
  });

  it("un ejercicio que no existe se rechaza", async () => {
    const { repository: exercises } = fakeExerciseRepository(null);
    const handler = new UpdateExerciseHandler(fakeContentUnitRepository(unidad()), exercises, fakeUow());

    await expect(
      handler.execute(
        new UpdateExerciseCommand({
          contentUnitId: UNIT_ID.value,
          exerciseId: EXERCISE_ID.value,
          prompt: { question: "¿Dónde te duele?", options: ["la cabeza", "el pie"] },
          solution: { correct: 0 },
        }),
      ),
    ).rejects.toThrow();
  });

  it("un ejercicio de otra unidad no se puede editar a través de esta", async () => {
    const { repository: exercises } = fakeExerciseRepository({
      id: EXERCISE_ID.value,
      contentUnitId: OTRA_UNIDAD_ID,
      type: "multiple_choice",
    });
    const handler = new UpdateExerciseHandler(fakeContentUnitRepository(unidad()), exercises, fakeUow());

    await expect(
      handler.execute(
        new UpdateExerciseCommand({
          contentUnitId: UNIT_ID.value,
          exerciseId: EXERCISE_ID.value,
          prompt: { question: "¿Dónde te duele?", options: ["la cabeza", "el pie"] },
          solution: { correct: 0 },
        }),
      ),
    ).rejects.toThrow();
  });
});
