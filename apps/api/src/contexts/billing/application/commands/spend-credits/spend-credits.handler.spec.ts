import type { PinoLogger } from "nestjs-pino";
import { describe, expect, it, vi } from "vitest";
import type { Clock } from "../../../../shared/domain/ports/clock.port.js";
import type { UnitOfWork } from "../../../../shared/domain/ports/unit-of-work.port.js";
import { SchoolId } from "../../../../shared/domain/primitives/school-id.js";
import { CreditBalance } from "../../../domain/model/credit-balance.aggregate.js";
import type { CreditBalanceRepository } from "../../../domain/ports/credit-balance.repository.port.js";
import { SpendCreditsCommand } from "./spend-credits.command.js";
import { SpendCreditsHandler } from "./spend-credits.handler.js";

const NOW = new Date("2026-07-27T10:00:00Z");
const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");

function fakeUow(): UnitOfWork {
  return { execute: (work) => work(), read: (work) => work() };
}

function fakeClock(): Clock {
  return { now: () => NOW };
}

function fakeLogger(): PinoLogger {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
}

/** Doble en memoria sobre el agregado REAL: lo que se prueba es el manejador, no el repositorio. */
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

describe("SpendCreditsHandler", () => {
  it("gasta los créditos pedidos y guarda el saldo resultante", async () => {
    const credits = fakeCreditRepository({ balance: 100, hardLimit: true });
    const handler = new SpendCreditsHandler(credits, fakeUow(), fakeClock(), fakeLogger());

    const result = await handler.execute(
      new SpendCreditsCommand({ credits: 30, costCents: 94, note: "reserva estimada", aiGenerationId: "gen-1" }),
    );

    expect(result).toEqual({ balanceAfter: 70, overdrawn: false });
    expect(credits.current().balance).toBe(70);
    expect(credits.saveCalls).toHaveLength(1);
  });

  it("con tope duro y saldo insuficiente, rechaza el gasto y no guarda nada", async () => {
    const credits = fakeCreditRepository({ balance: 10, hardLimit: true });
    const handler = new SpendCreditsHandler(credits, fakeUow(), fakeClock(), fakeLogger());

    await expect(
      handler.execute(new SpendCreditsCommand({ credits: 11, note: "reserva estimada" })),
    ).rejects.toThrow(/no hay créditos suficientes/i);

    expect(credits.saveCalls).toHaveLength(0);
    expect(credits.current().balance).toBe(10);
  });

  it("con saldo en cero y tope duro, la generación se rechaza también en el límite exacto", async () => {
    const credits = fakeCreditRepository({ balance: 0, hardLimit: true });
    const handler = new SpendCreditsHandler(credits, fakeUow(), fakeClock(), fakeLogger());

    await expect(
      handler.execute(new SpendCreditsCommand({ credits: 1, note: "reserva estimada" })),
    ).rejects.toThrow(/no hay créditos suficientes/i);
  });

  it("sin tope duro, permite el gasto por encima del saldo y avisa (overdrawn)", async () => {
    const credits = fakeCreditRepository({ balance: 5, hardLimit: false });
    const logger = fakeLogger();
    const handler = new SpendCreditsHandler(credits, fakeUow(), fakeClock(), logger);

    const result = await handler.execute(new SpendCreditsCommand({ credits: 8, note: "reserva estimada" }));

    expect(result).toEqual({ balanceAfter: -3, overdrawn: true });
    expect(logger.warn).toHaveBeenCalled();
  });
});
