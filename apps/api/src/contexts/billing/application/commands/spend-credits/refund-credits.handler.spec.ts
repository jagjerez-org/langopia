import { describe, expect, it } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { CreditBalance } from "../../../domain/model/credit-balance.aggregate.js";
import type { CreditBalanceRepository } from "../../../domain/ports/credit-balance.repository.port.js";
import { RefundCreditsCommand } from "./refund-credits.command.js";
import { RefundCreditsHandler } from "./refund-credits.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeCreditRepository(params: { balance: number; hardLimit: boolean }) {
  let current = CreditBalance.rehydrate({ schoolId: SCHOOL, balance: params.balance, hardLimit: params.hardLimit });
  const saveCalls: CreditBalance[] = [];

  const repo: CreditBalanceRepository & { saveCalls: CreditBalance[]; current: () => CreditBalance } = {
    saveCalls,
    current: () => current,
    findForUpdate: async () => current,
    save: async (balance) => {
      current = balance;
      saveCalls.push(balance);
    },
  };
  return repo;
}

describe("RefundCreditsHandler", () => {
  it("devuelve créditos y sube el saldo", async () => {
    const credits = fakeCreditRepository({ balance: 10, hardLimit: true });
    const handler = new RefundCreditsHandler(credits, fakeUow(), fakeClock());

    const result = await handler.execute(
      new RefundCreditsCommand({ credits: 30, note: "generación fallida", aiGenerationId: "gen-1" }),
    );

    expect(result).toEqual({ balanceAfter: 40 });
    expect(credits.current().balance).toBe(40);
  });

  it("devuelve créditos incluso con el saldo en cero y tope duro activo", async () => {
    const credits = fakeCreditRepository({ balance: 0, hardLimit: true });
    const handler = new RefundCreditsHandler(credits, fakeUow(), fakeClock());

    const result = await handler.execute(new RefundCreditsCommand({ credits: 5, note: "ajuste" }));

    expect(result).toEqual({ balanceAfter: 5 });
  });
});
