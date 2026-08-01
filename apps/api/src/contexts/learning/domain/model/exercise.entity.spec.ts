import { describe, expect, it } from "vitest";
import { Exercise } from "./exercise.entity.js";
import { InvalidExerciseError } from "./exercise-schemas.js";
import { ContentUnitId, ExerciseId } from "./identifiers.js";

const ID = ExerciseId.of("11111111-1111-4111-8111-111111111111");
const CONTENT_UNIT_ID = ContentUnitId.of("22222222-2222-4222-8222-222222222222");
const RUBRIC_ID = "33333333-3333-4333-8333-333333333333";

describe("Exercise", () => {
  it("se crea con un tipo sin rúbrica ni audio (multiple_choice)", () => {
    const exercise = Exercise.create({
      id: ID,
      contentUnitId: CONTENT_UNIT_ID,
      type: "multiple_choice",
      prompt: { question: "¿?", options: ["a", "b"] },
      solution: { correct: 0 },
    });

    expect(exercise.type).toBe("multiple_choice");
    expect(exercise.requiresTeacherValidation).toBe(false);
  });

  it("un written_production sin rubricId se rechaza", () => {
    expect(() =>
      Exercise.create({
        id: ID,
        contentUnitId: CONTENT_UNIT_ID,
        type: "written_production",
        prompt: { task: "Escribe algo.", minWords: 50, maxWords: 100, register: "formal" },
        requiresTeacherValidation: true,
      }),
    ).toThrow(InvalidExerciseError);
  });

  it("un written_production con rubricId pero sin requiresTeacherValidation se rechaza", () => {
    // La IA propone, el profesor firma: sin esta bandera la nota podría
    // colarse en el expediente sin que nadie la validara.
    expect(() =>
      Exercise.create({
        id: ID,
        contentUnitId: CONTENT_UNIT_ID,
        type: "written_production",
        prompt: { task: "Escribe algo.", minWords: 50, maxWords: 100, register: "formal" },
        rubricId: RUBRIC_ID,
      }),
    ).toThrow(InvalidExerciseError);
  });

  it("un written_production con rubricId y requiresTeacherValidation se acepta", () => {
    const exercise = Exercise.create({
      id: ID,
      contentUnitId: CONTENT_UNIT_ID,
      type: "written_production",
      prompt: { task: "Escribe algo.", minWords: 50, maxWords: 100, register: "formal" },
      rubricId: RUBRIC_ID,
      requiresTeacherValidation: true,
    });

    expect(exercise.rubricId).toBe(RUBRIC_ID);
    expect(exercise.requiresTeacherValidation).toBe(true);
  });

  it("un spoken_production sin rubricId también se rechaza", () => {
    expect(() =>
      Exercise.create({
        id: ID,
        contentUnitId: CONTENT_UNIT_ID,
        type: "spoken_production",
        prompt: { task: "Habla de algo.", durationSeconds: 60 },
        requiresTeacherValidation: true,
      }),
    ).toThrow(InvalidExerciseError);
  });

  it("un dictation cuya unidad no tiene audio se rechaza", () => {
    expect(() =>
      Exercise.create({
        id: ID,
        contentUnitId: CONTENT_UNIT_ID,
        type: "dictation",
        prompt: { audioRef: "unit-audio", segments: 1 },
        solution: { segments: ["Hola."] },
        unitHasAudioAsset: false,
      }),
    ).toThrow(InvalidExerciseError);
  });

  it("un dictation cuya unidad sí tiene audio se acepta", () => {
    const exercise = Exercise.create({
      id: ID,
      contentUnitId: CONTENT_UNIT_ID,
      type: "dictation",
      prompt: { audioRef: "unit-audio", segments: 1 },
      solution: { segments: ["Hola."] },
      unitHasAudioAsset: true,
    });

    expect(exercise.type).toBe("dictation");
  });

  it("un ejercicio con prompt inválido se rechaza antes de mirar rúbrica o audio", () => {
    expect(() =>
      Exercise.create({
        id: ID,
        contentUnitId: CONTENT_UNIT_ID,
        type: "multiple_choice",
        prompt: { question: "¿?", options: ["única"] },
        solution: { correct: 0 },
      }),
    ).toThrow(InvalidExerciseError);
  });
});
