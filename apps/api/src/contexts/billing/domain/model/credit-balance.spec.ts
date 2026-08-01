import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { CreditBalance, CreditReason } from "./credit-balance.aggregate.js";

const AHORA = new Date("2026-11-02T10:00:00Z");
const ESCUELA = SchoolId.of("11111111-1111-4111-8111-111111111111");

function saldo(params: { balance: number; hardLimit: boolean }) {
  return CreditBalance.rehydrate({ schoolId: ESCUELA, balance: params.balance, hardLimit: params.hardLimit });
}

describe("CreditBalance", () => {
  it("concede créditos y sube el saldo", () => {
    const cuenta = saldo({ balance: 100, hardLimit: true });

    cuenta.grant({ credits: 50, reason: CreditReason.Topup, note: "recarga", now: AHORA });

    expect(cuenta.balance).toBe(150);
    const [movimiento] = cuenta.pullMovements();
    expect(movimiento).toEqual({
      delta: 50,
      balanceAfter: 150,
      reason: "topup",
      costCents: 0,
      aiGenerationId: null,
      note: "recarga",
      now: AHORA,
    });
  });

  it("gasta créditos y baja el saldo", () => {
    const cuenta = saldo({ balance: 100, hardLimit: true });

    cuenta.spend({ credits: 30, costCents: 94, aiGenerationId: "gen-1", now: AHORA });

    expect(cuenta.balance).toBe(70);
    const [movimiento] = cuenta.pullMovements();
    expect(movimiento).toMatchObject({
      delta: -30,
      balanceAfter: 70,
      reason: "generation",
      costCents: 94,
      aiGenerationId: "gen-1",
    });
  });

  it("con tope duro, gastar más de lo que hay se rechaza y no toca el saldo", () => {
    const cuenta = saldo({ balance: 10, hardLimit: true });

    expect(() => cuenta.spend({ credits: 11, now: AHORA })).toThrow(/no hay créditos suficientes/i);
    expect(cuenta.balance).toBe(10);
    expect(cuenta.pullMovements()).toEqual([]);
  });

  it("con tope duro, gastar exactamente el saldo disponible lo deja en cero", () => {
    const cuenta = saldo({ balance: 10, hardLimit: true });

    cuenta.spend({ credits: 10, now: AHORA });

    expect(cuenta.balance).toBe(0);
  });

  it("con tope duro y saldo en cero, cualquier gasto se rechaza", () => {
    const cuenta = saldo({ balance: 0, hardLimit: true });

    expect(() => cuenta.spend({ credits: 1, now: AHORA })).toThrow(/no hay créditos suficientes/i);
  });

  it("sin tope duro, un gasto mayor que el saldo se permite y el saldo queda negativo", () => {
    const cuenta = saldo({ balance: 5, hardLimit: false });

    cuenta.spend({ credits: 8, now: AHORA });

    expect(cuenta.balance).toBe(-3);
  });

  it("devuelve créditos: una generación fallida no se cobra", () => {
    const cuenta = saldo({ balance: 0, hardLimit: true });

    cuenta.refund({ credits: 20, aiGenerationId: "gen-2", now: AHORA });

    expect(cuenta.balance).toBe(20);
    const [movimiento] = cuenta.pullMovements();
    expect(movimiento).toMatchObject({ delta: 20, reason: "refund", aiGenerationId: "gen-2" });
  });

  it("tope de acumulación: la renovación del plan solo concede hasta llegar al tope", () => {
    // Plan de 250 créditos incluidos: el tope de acumulación es el doble, 500.
    // El saldo ya tiene 450 (sobras de meses anteriores) — solo caben 50 más.
    const cuenta = saldo({ balance: 450, hardLimit: true });

    cuenta.grant({ credits: 250, reason: CreditReason.PlanGrant, cap: 500, now: AHORA });

    expect(cuenta.balance).toBe(500);
    const [movimiento] = cuenta.pullMovements();
    expect(movimiento?.delta).toBe(50);
  });

  it("tope de acumulación: ya en el tope (o por encima), la renovación no concede nada", () => {
    const cuenta = saldo({ balance: 600, hardLimit: true });

    cuenta.grant({ credits: 250, reason: CreditReason.PlanGrant, cap: 500, now: AHORA });

    expect(cuenta.balance).toBe(600);
    expect(cuenta.pullMovements()).toEqual([]);
  });

  it("rechaza conceder, gastar o devolver una cantidad que no es un entero positivo", () => {
    const cuenta = saldo({ balance: 100, hardLimit: true });

    expect(() => cuenta.grant({ credits: 0, reason: CreditReason.Topup, now: AHORA })).toThrow(
      /entero positivo/i,
    );
    expect(() => cuenta.spend({ credits: -5, now: AHORA })).toThrow(/entero positivo/i);
    expect(() => cuenta.refund({ credits: 1.5, now: AHORA })).toThrow(/entero positivo/i);
  });

  it("pullMovements() vacía la lista: una segunda llamada no repite los mismos movimientos", () => {
    const cuenta = saldo({ balance: 100, hardLimit: true });
    cuenta.spend({ credits: 10, now: AHORA });

    expect(cuenta.pullMovements()).toHaveLength(1);
    expect(cuenta.pullMovements()).toEqual([]);
  });
});
