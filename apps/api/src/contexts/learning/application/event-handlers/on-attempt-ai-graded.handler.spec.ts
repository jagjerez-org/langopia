import { describe, expect, it } from "vitest";
import { AttemptAiGraded } from "../../../assessment/domain/events/attempt.events.js";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { IdGenerator } from "../../../shared/domain/ports/id-generator.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import type { ContentUnit } from "../../domain/model/content-unit.aggregate.js";
import { SrsCard } from "../../domain/model/srs-card.aggregate.js";
import { ExerciseId, SrsCardId } from "../../domain/model/identifiers.js";
import type {
  ContentUnitRepository,
  ContentUnitTranslation,
  ExerciseSrsInfo,
} from "../../domain/ports/content-unit.repository.port.js";
import type { Exercise } from "../../domain/model/exercise.entity.js";
import type { SrsCardRepository } from "../../domain/ports/srs-card.repository.port.js";
import type { SchoolCalendarPort } from "../../domain/ports/school-calendar.port.js";
import { OnAttemptAiGraded } from "./on-attempt-ai-graded.handler.js";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const EXERCISE_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const ATTEMPT_ID = "44444444-4444-4444-8444-444444444444";
const NEW_CARD_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-07-27T10:00:00Z");
const TODAY = "2026-07-27";

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

function gradedEvent(aiScore: number): AttemptAiGraded {
  return new AttemptAiGraded({
    attemptId: ATTEMPT_ID,
    schoolId: SCHOOL_ID,
    exerciseId: EXERCISE_ID,
    studentProfileId: STUDENT_ID,
    aiScore,
  });
}

function unusedContentUnitRepository(): ContentUnitRepository {
  const fail = (): never => {
    throw new Error("no usado en esta prueba");
  };
  return {
    save: (_unit: ContentUnit) => fail(),
    saveTranslation: (_unit: ContentUnit, _t: ContentUnitTranslation) => fail(),
    addExercises: (_unit: ContentUnit, _e: readonly Exercise[]) => fail(),
    findById: () => fail(),
    findRubricIdByCode: () => fail(),
    findExerciseSrsInfo: () => fail(),
  } as unknown as ContentUnitRepository;
}

function buildHandler(params: {
  exerciseInfo: ExerciseSrsInfo | null;
  existingCard?: SrsCard | null;
}) {
  const saved: SrsCard[] = [];
  const findCalls: Array<{ studentProfileId: string; exerciseId: string }> = [];

  const exercises: ContentUnitRepository = {
    ...unusedContentUnitRepository(),
    findExerciseSrsInfo: async () => params.exerciseInfo,
  };
  const cards: SrsCardRepository = {
    findByStudentAndExercise: async (studentProfileId, exerciseId) => {
      findCalls.push({ studentProfileId, exerciseId: exerciseId.value });
      return params.existingCard ?? null;
    },
    save: async (card) => {
      saved.push(card);
    },
    createVocabularyCardsForParticipants: async () => 0,
    findDueForStudent: async () => {
      throw new Error("no usado en esta prueba");
    },
  };
  const calendarCalls: Date[] = [];
  const calendar: SchoolCalendarPort = {
    today: async (now) => {
      calendarCalls.push(now);
      return TODAY;
    },
  };
  const clock: Clock = { now: () => NOW };
  const ids: IdGenerator = { generate: () => NEW_CARD_ID };

  const handler = new OnAttemptAiGraded(
    cards,
    exercises,
    calendar,
    fakeUow(),
    clock,
    ids,
    fakeLogger() as never,
  );

  return { handler, saved, findCalls, calendarCalls };
}

describe("OnAttemptAiGraded (paso 4 del brief: abre tarjeta al fallar un ejercicio con srsEnabled)", () => {
  it("un ejercicio sin srsEnabled no abre ninguna tarjeta", async () => {
    const { handler, saved } = buildHandler({
      exerciseInfo: { maxScore: 1, srsEnabled: false },
    });

    await handler.handle(gradedEvent(0));

    expect(saved).toEqual([]);
  });

  it("un ejercicio que ya no existe (o RLS lo oculta) no revienta y no abre tarjeta", async () => {
    const { handler, saved } = buildHandler({ exerciseInfo: null });

    await handler.handle(gradedEvent(0));

    expect(saved).toEqual([]);
  });

  it("un acierto (nota perfecta) con srsEnabled no abre tarjeta", async () => {
    const { handler, saved } = buildHandler({
      exerciseInfo: { maxScore: 2, srsEnabled: true },
    });

    await handler.handle(gradedEvent(2)); // 2/2 → quality 5

    expect(saved).toEqual([]);
  });

  it("un fallo total (nota 0) con srsEnabled abre una tarjeta nueva", async () => {
    const { handler, saved, findCalls } = buildHandler({
      exerciseInfo: { maxScore: 2, srsEnabled: true },
      existingCard: null,
    });

    await handler.handle(gradedEvent(0));

    expect(findCalls).toEqual([{ studentProfileId: STUDENT_ID, exerciseId: EXERCISE_ID }]);
    expect(saved).toHaveLength(1);
    const card = saved[0]!;
    expect(card.id.value).toBe(NEW_CARD_ID);
    expect(card.studentProfileId).toBe(STUDENT_ID);
    expect(card.exerciseId!.value).toBe(EXERCISE_ID);
    expect(card.lapses).toBe(1);
    expect(card.dueOn).toBe("2026-07-28");
  });

  it("una nota a medias (por debajo del umbral de acierto) también abre tarjeta", async () => {
    // 1/4 → ratio 0.25 → quality round(1.25) = 1, por debajo de 3: fallo.
    const { handler, saved } = buildHandler({
      exerciseInfo: { maxScore: 4, srsEnabled: true },
    });

    await handler.handle(gradedEvent(1));

    expect(saved).toHaveLength(1);
  });

  it("fallar un ejercicio que YA tiene tarjeta la repite (review), no crea una segunda", async () => {
    const previa = SrsCard.rehydrate({
      id: SrsCardId.of("77777777-7777-4777-8777-777777777777"),
      schoolId: SchoolId.of(SCHOOL_ID),
      studentProfileId: STUDENT_ID,
      exerciseId: ExerciseId.of(EXERCISE_ID),
      ease: 2.5,
      intervalDays: 6,
      repetitions: 2,
      lapses: 0,
      dueOn: "2026-07-20",
      lastReviewedAt: new Date("2026-07-14T00:00:00Z"),
    });

    const { handler, saved } = buildHandler({
      exerciseInfo: { maxScore: 2, srsEnabled: true },
      existingCard: previa,
    });

    await handler.handle(gradedEvent(0));

    expect(saved).toHaveLength(1);
    expect(saved[0]).toBe(previa);
    expect(previa.id.value).toBe("77777777-7777-4777-8777-777777777777");
    expect(previa.repetitions).toBe(0); // el fallo reinició la racha
    expect(previa.lapses).toBe(1);
  });

  it("resuelve «hoy» con la fecha de la escuela (SchoolCalendarPort), no con la del proceso", async () => {
    const { handler, calendarCalls } = buildHandler({
      exerciseInfo: { maxScore: 1, srsEnabled: true },
    });

    await handler.handle(gradedEvent(0));

    expect(calendarCalls).toEqual([NOW]);
  });
});
