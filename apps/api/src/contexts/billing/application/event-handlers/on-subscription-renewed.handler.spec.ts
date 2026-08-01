import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionRenewed } from "../../domain/events/subscription.events.js";
import type { Clock } from "../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CreditBalance } from "../../domain/model/credit-balance.aggregate.js";
import type { CreditBalanceRepository } from "../../domain/ports/credit-balance.repository.port.js";
import { OnSubscriptionRenewed } from "./on-subscription-renewed.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const SCHOOL = SchoolId.of(SCHOOL_ID);

function buildEvent(includedAiCredits: number): SubscriptionRenewed {
  return new SubscriptionRenewed({
    subscriptionId: "22222222-2222-4222-8222-222222222222",
    schoolId: SCHOOL_ID,
    planCode: "growth",
    includedAiCredits,
    periodStart: new Date("2026-07-01T00:00:00Z"),
    periodEnd: new Date("2026-08-01T00:00:00Z"),
  });
}

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeLogger(): PinoLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

function fakeCreditRepository(balance: number) {
  let current = CreditBalance.rehydrate({ schoolId: SCHOOL, balance, hardLimit: true });
  const saveCalls: CreditBalance[] = [];

  const repo: CreditBalanceRepository & { saveCalls: CreditBalance[]; current: () => CreditBalance } = {
    saveCalls,
    current: () => current,
    findForUpdate: async () => current,
    save: async (b) => {
      current = b;
      saveCalls.push(b);
    },
  };
  return repo;
}

describe("OnSubscriptionRenewed", () => {
  it("concede los créditos incluidos del plan", async () => {
    const credits = fakeCreditRepository(50);
    const handler = new OnSubscriptionRenewed(credits, fakeUow(), fakeClock(), fakeLogger());

    await handler.handle(buildEvent(250));

    expect(credits.current().balance).toBe(300);
  });

  it("el tope de acumulación es el doble de los créditos del plan: no deja acumular un año sin usar", async () => {
    // 250 incluidos, tope 500. El saldo ya tiene 480 de sobra de meses
    // anteriores — solo caben 20 más, no los 250 completos.
    const credits = fakeCreditRepository(480);
    const handler = new OnSubscriptionRenewed(credits, fakeUow(), fakeClock(), fakeLogger());

    await handler.handle(buildEvent(250));

    expect(credits.current().balance).toBe(500);
  });

  it("ya en el tope (o por encima), la renovación no concede nada", async () => {
    const credits = fakeCreditRepository(600);
    const handler = new OnSubscriptionRenewed(credits, fakeUow(), fakeClock(), fakeLogger());

    await handler.handle(buildEvent(250));

    expect(credits.current().balance).toBe(600);
  });
});
