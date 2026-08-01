import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { SrsCard } from "../../../domain/model/srs-card.aggregate.js";
import { ExerciseId, SrsCardId } from "../../../domain/model/identifiers.js";
import type { SchoolCalendarPort } from "../../../domain/ports/school-calendar.port.js";
import type { SrsCardRepository } from "../../../domain/ports/srs-card.repository.port.js";
import { GetDueCardsHandler, GetDueCardsQuery, MAX_DUE_CARDS_PER_SESSION } from "./get-due-cards.handler.js";

const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const SCHOOL_ID = SchoolId.of("11111111-1111-4111-8111-111111111111");
const NOW = new Date("2026-07-27T23:30:00Z");
const TODAY = "2026-07-28"; // p.ej. una escuela en Madrid, donde a esa hora ya es el día siguiente

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function cardDueOn(dueOn: string, id: string): SrsCard {
  return SrsCard.rehydrate({
    id: SrsCardId.of(id),
    schoolId: SCHOOL_ID,
    studentProfileId: STUDENT_ID,
    exerciseId: ExerciseId.of("22222222-2222-4222-8222-222222222222"),
    ease: 2.0,
    intervalDays: 3,
    repetitions: 1,
    lapses: 1,
    dueOn,
    lastReviewedAt: null,
  });
}

/** Un uuid válido y distinto por índice, determinista para las pruebas. */
function uuidFor(i: number): string {
  const hex = i.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
}

/**
 * Repositorio falso que se comporta como haría la consulta SQL real:
 * filtra por `dueOn <= onOrBefore`, ordena de más vencida a menos, y aplica
 * `limit`. Así la prueba de la «avalancha» comprueba el comportamiento de
 * verdad, no solo que se pidió el número correcto.
 */
function fakeRepository(allCards: SrsCard[]): SrsCardRepository {
  return {
    findByStudentAndExercise: async () => {
      throw new Error("no usado en esta prueba");
    },
    save: async () => {
      throw new Error("no usado en esta prueba");
    },
    createVocabularyCardsForParticipants: async () => 0,
    findDueForStudent: async (params) => {
      return allCards
        .filter((c) => c.studentProfileId === params.studentProfileId && c.dueOn <= params.onOrBefore)
        .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0))
        .slice(0, params.limit);
    },
  };
}

function buildHandler(cards: SrsCard[]) {
  const calendarCalls: Date[] = [];
  const calendar: SchoolCalendarPort = {
    today: async (now) => {
      calendarCalls.push(now);
      return TODAY;
    },
  };
  const clock: Clock = { now: () => NOW };
  const handler = new GetDueCardsHandler(fakeRepository(cards), calendar, fakeUow(), clock);
  return { handler, calendarCalls };
}

describe("GetDueCardsQuery (paso 5 del brief: tarjetas pendientes de hoy)", () => {
  it("resuelve «hoy» con la zona horaria de la escuela antes de preguntar por las tarjetas", async () => {
    const { handler, calendarCalls } = buildHandler([]);

    await handler.execute(new GetDueCardsQuery({ studentProfileId: STUDENT_ID }));

    expect(calendarCalls).toEqual([NOW]);
  });

  it("devuelve las tarjetas vencidas o de hoy, de la más antigua a la menos, mapeadas a su forma de salida", async () => {
    const vencida = cardDueOn("2026-07-20", uuidFor(1));
    const deHoy = cardDueOn(TODAY, uuidFor(2));
    const futura = cardDueOn("2026-08-01", uuidFor(3));
    const { handler } = buildHandler([futura, deHoy, vencida]);

    const result = await handler.execute(new GetDueCardsQuery({ studentProfileId: STUDENT_ID }));

    expect(result.map((c) => c.id)).toEqual([vencida.id.value, deHoy.id.value]);
    expect(result[0]).toEqual({
      id: vencida.id.value,
      exerciseId: vencida.exerciseId!.value,
      ease: vencida.ease,
      intervalDays: vencida.intervalDays,
      repetitions: vencida.repetitions,
      lapses: vencida.lapses,
      dueOn: vencida.dueOn,
      lastReviewedAt: vencida.lastReviewedAt,
    });
  });

  it("el alumno que vuelve tras un mes con trescientas tarjetas vencidas ve como mucho el tope, empezando por lo más antiguo", async () => {
    const backlog = Array.from({ length: 300 }, (_, i) =>
      // Las más antiguas tienen el índice más bajo: dueOn decreciente según i crece.
      cardDueOn(`2026-0${1 + (i % 6)}-0${1 + (i % 8)}`, uuidFor(i)),
    );
    // Muy anterior a cualquier fecha del atraso simulado (que empieza en 2026), para no empatar con él.
    const masAntigua = cardDueOn("2020-01-01", uuidFor(999));
    const { handler } = buildHandler([...backlog, masAntigua]);

    const result = await handler.execute(new GetDueCardsQuery({ studentProfileId: STUDENT_ID }));

    expect(result).toHaveLength(MAX_DUE_CARDS_PER_SESSION);
    expect(result[0]!.id).toBe(masAntigua.id.value);
  });

  it("no ve ninguna tarjeta de otro alumno", async () => {
    const otro = SrsCard.rehydrate({
      id: SrsCardId.of(uuidFor(5)),
      schoolId: SCHOOL_ID,
      studentProfileId: "99999999-9999-4999-8999-999999999999",
      exerciseId: ExerciseId.of("22222222-2222-4222-8222-222222222222"),
      ease: 2.5,
      intervalDays: 1,
      repetitions: 0,
      lapses: 1,
      dueOn: "2026-07-20",
      lastReviewedAt: null,
    });
    const { handler } = buildHandler([otro]);

    const result = await handler.execute(new GetDueCardsQuery({ studentProfileId: STUDENT_ID }));

    expect(result).toEqual([]);
  });
});
