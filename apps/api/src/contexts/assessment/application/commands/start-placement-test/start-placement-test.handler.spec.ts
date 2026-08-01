import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { EventPublisher } from "../../../../shared/domain/ports/event-publisher.port.js";
import type { IdGenerator } from "../../../../shared/domain/ports/id-generator.port.js";
import type { TenantContext } from "../../../../shared/domain/ports/tenant-context.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import type { PlacementBankItem, PlacementBankPort } from "../../../domain/ports/placement-bank.port.js";
import { StartPlacementTestCommand } from "./start-placement-test.command.js";
import { StartPlacementTestHandler } from "./start-placement-test.handler.js";

const ESCUELA = "11111111-1111-4111-8111-111111111111";
const ALUMNO = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-07-27T10:00:00Z");

const ITEM: PlacementBankItem = {
  id: "item-1",
  language: "es",
  level: "B1",
  skill: "grammar",
  prompt: { question: "Elige la opción correcta." },
  solution: { correct: 1 },
};

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}
function fakeEvents(): EventPublisher {
  return { publish: async () => undefined };
}
function fakeTenant(): TenantContext {
  return { schoolId: () => ESCUELA, membershipId: () => "actor", roles: () => ["teacher"], has: () => true };
}
function fakeClock(): Clock {
  return { now: () => NOW };
}
function fakeIds(): IdGenerator {
  return { generate: () => "99999999-9999-4999-8999-999999999999" };
}

function fakeBank(overrides: Partial<PlacementBankPort> = {}): PlacementBankPort {
  return {
    listSkills: async () => ["grammar", "vocabulary"],
    get: async () => ITEM,
    pickNext: async () => ITEM,
    ...overrides,
  };
}

describe("StartPlacementTestHandler", () => {
  it("abre la prueba en B1 y pide al banco la primera pregunta de la primera destreza", async () => {
    const bank = fakeBank();
    const handler = new StartPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeTenant(), fakeClock(), fakeIds());

    const result = await handler.execute(new StartPlacementTestCommand({ studentProfileId: ALUMNO, language: "es" }));

    expect(result.finished).toBe(false);
    expect(result.testId).toBe("99999999-9999-4999-8999-999999999999");
    expect(result.nextQuestion).toEqual({
      itemId: ITEM.id,
      skill: ITEM.skill,
      level: ITEM.level,
      prompt: ITEM.prompt,
    });
    expect(result.snapshot.language).toBe("es");
    expect(result.snapshot.skills).toEqual(["grammar", "vocabulary"]);
    expect(result.snapshot.levelIndex).toBe(2); // B1
    expect(result.snapshot.questionsAsked).toBe(0);
  });

  it("un banco sin ninguna destreza para el idioma se rechaza sin abrir la prueba", async () => {
    const bank = fakeBank({ listSkills: async () => [] });
    const handler = new StartPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeTenant(), fakeClock(), fakeIds());

    await expect(
      handler.execute(new StartPlacementTestCommand({ studentProfileId: ALUMNO, language: "de" })),
    ).rejects.toThrow(/nivelación/i);
  });

  it("un banco sin ningún ítem disponible para el primer criterio se rechaza", async () => {
    const bank = fakeBank({ pickNext: async () => null });
    const handler = new StartPlacementTestHandler(bank, fakeUow(), fakeEvents(), fakeTenant(), fakeClock(), fakeIds());

    await expect(
      handler.execute(new StartPlacementTestCommand({ studentProfileId: ALUMNO, language: "es" })),
    ).rejects.toThrow(/nivelación/i);
  });
});
