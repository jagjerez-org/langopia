import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { PlacementTestId } from "../../../domain/model/identifiers.js";
import { PlacementTest, type PlacementTestSnapshot } from "../../../domain/model/placement-test.aggregate.js";
import type { PlacementBankItem, PlacementBankPort } from "../../../domain/ports/placement-bank.port.js";
import { AnswerPlacementTestCommand } from "./answer-placement-test.command.js";
import { AnswerPlacementTestHandler } from "./answer-placement-test.handler.js";

const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");
const ALUMNO = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-27T10:00:00Z");

const ITEM_ACTUAL: PlacementBankItem = {
  id: "item-actual",
  language: "es",
  level: "B1",
  skill: "grammar",
  prompt: { question: "¿Cuál es correcta?" },
  solution: { correct: 1 },
};

const ITEM_SIGUIENTE: PlacementBankItem = {
  id: "item-siguiente",
  language: "es",
  level: "B1",
  skill: "vocabulary",
  prompt: { question: "Elige el sinónimo." },
  solution: { correct: 0 },
};

function snapshotDePrueba(skills: readonly string[] = ["grammar", "vocabulary"]): PlacementTestSnapshot {
  const test = PlacementTest.start({
    id: PlacementTestId.of("33333333-3333-4333-8333-333333333333"),
    schoolId: ESCUELA,
    studentProfileId: ALUMNO,
    language: "es",
    skills,
    now: NOW,
  });
  return test.toSnapshot();
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeBank(overrides: Partial<PlacementBankPort> = {}): PlacementBankPort {
  return {
    listSkills: async () => ["grammar", "vocabulary"],
    get: async (itemId) => (itemId === ITEM_ACTUAL.id ? ITEM_ACTUAL : null),
    pickNext: async () => ITEM_SIGUIENTE,
    ...overrides,
  };
}

describe("AnswerPlacementTestHandler", () => {
  it("una respuesta correcta se registra y el banco sirve la siguiente pregunta", async () => {
    const snapshot = snapshotDePrueba();
    const bank = fakeBank();
    const handler = new AnswerPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeClock());

    const result = await handler.execute(
      new AnswerPlacementTestCommand({
        testId: snapshot.id,
        snapshot,
        itemId: ITEM_ACTUAL.id,
        response: { correct: 1 }, // coincide con la solución del ítem
      }),
    );

    expect(result.finished).toBe(false);
    expect(result.snapshot.questionsAsked).toBe(1);
    expect(result.snapshot.consecutiveCorrect).toBe(1);
    expect(result.nextQuestion).toEqual({
      itemId: ITEM_SIGUIENTE.id,
      skill: ITEM_SIGUIENTE.skill,
      level: ITEM_SIGUIENTE.level,
      prompt: ITEM_SIGUIENTE.prompt,
    });
    expect(result.result).toBeNull();
  });

  it("una respuesta incorrecta también se registra, sin subir la racha de aciertos", async () => {
    const snapshot = snapshotDePrueba();
    const bank = fakeBank();
    const handler = new AnswerPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeClock());

    const result = await handler.execute(
      new AnswerPlacementTestCommand({
        testId: snapshot.id,
        snapshot,
        itemId: ITEM_ACTUAL.id,
        response: { correct: 0 }, // no coincide: la solución es 1
      }),
    );

    expect(result.snapshot.consecutiveCorrect).toBe(0);
    expect(result.snapshot.consecutiveIncorrect).toBe(1);
  });

  it("el testId de la URL debe coincidir con el snapshot recibido", async () => {
    const snapshot = snapshotDePrueba();
    const handler = new AnswerPlacementTestHandler(fakeBank(), fakeUow(), fakeEvents(), fakeClock());

    await expect(
      handler.execute(
        new AnswerPlacementTestCommand({
          testId: "44444444-4444-4444-8444-444444444444",
          snapshot,
          itemId: ITEM_ACTUAL.id,
          response: { correct: 1 },
        }),
      ),
    ).rejects.toThrow(/no coincide/i);
  });

  it("un ítem que no existe (o no es de esta escuela) se rechaza", async () => {
    const snapshot = snapshotDePrueba();
    const bank = fakeBank({ get: async () => null });
    const handler = new AnswerPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeClock());

    await expect(
      handler.execute(
        new AnswerPlacementTestCommand({
          testId: snapshot.id,
          snapshot,
          itemId: "item-inexistente",
          response: { correct: 1 },
        }),
      ),
    ).rejects.toThrow();
  });

  it("al terminar la prueba no se pide ninguna pregunta más y se devuelve el resultado", async () => {
    // Alternar acierto/fallo estabiliza (y termina) a las seis preguntas.
    const test = PlacementTest.start({
      id: PlacementTestId.of("33333333-3333-4333-8333-333333333333"),
      schoolId: ESCUELA,
      studentProfileId: ALUMNO,
      language: "es",
      skills: ["grammar", "vocabulary"],
      now: NOW,
    });
    const patron = [true, false, true, false, true];
    for (const correcto of patron) {
      const criteria = test.nextItemCriteria()!;
      test.answer({ itemId: `previo-${criteria.skill}`, skill: criteria.skill, level: criteria.level, correct: correcto, now: NOW });
    }
    expect(test.finished).toBe(false);
    const snapshot = test.toSnapshot();

    const bank = fakeBank({ get: async () => ITEM_ACTUAL, pickNext: async () => ITEM_SIGUIENTE });
    const handler = new AnswerPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeClock());

    const result = await handler.execute(
      new AnswerPlacementTestCommand({
        testId: snapshot.id,
        snapshot,
        itemId: ITEM_ACTUAL.id,
        response: { correct: 0 }, // sexta respuesta: falla, como pide el patrón
      }),
    );

    expect(result.finished).toBe(true);
    expect(result.nextQuestion).toBeNull();
    expect(result.result).not.toBeNull();
    expect(result.result!.questionsAsked).toBe(6);
  });
});
