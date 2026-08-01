import { describe, expect, it } from "vitest";
import { Money } from "./money.vo.js";
import { PlatformFee } from "./platform-fee.vo.js";

describe("PlatformFee", () => {
  it("al 0% la comisión es cero", () => {
    const fee = PlatformFee.of({ amount: Money.of(10_000, "EUR"), bps: 0 });
    expect(fee.bps).toBe(0);
    expect(fee.cents).toBe(0);
  });

  it("al 2% sobre 100,00€ la comisión es 2,00€ — el caso del brief", () => {
    const fee = PlatformFee.of({ amount: Money.of(10_000, "EUR"), bps: 200 });
    expect(fee.bps).toBe(200);
    expect(fee.cents).toBe(200);
  });

  it("aplica el tope cuando la comisión calculada lo supera", () => {
    const fee = PlatformFee.of({
      amount: Money.of(100_000, "EUR"), // 1000,00€
      bps: 200, // sin tope: 20,00€
      capCents: 1500, // tope: 15,00€
    });
    expect(fee.cents).toBe(1500);
  });

  it("no aplica el tope cuando la comisión calculada no lo alcanza", () => {
    const fee = PlatformFee.of({
      amount: Money.of(1_000, "EUR"), // 10,00€
      bps: 200, // 0,20€
      capCents: 1500,
    });
    expect(fee.cents).toBe(20);
  });

  it("redondea al céntimo más cercano", () => {
    // 333 * 250 / 10000 = 8,325 -> redondea a 8
    const fee = PlatformFee.of({ amount: Money.of(333, "EUR"), bps: 250 });
    expect(fee.cents).toBe(8);
  });

  it("redondea hacia arriba a partir de la mitad del céntimo", () => {
    // 350 * 250 / 10000 = 8,75 -> redondea a 9
    const fee = PlatformFee.of({ amount: Money.of(350, "EUR"), bps: 250 });
    expect(fee.cents).toBe(9);
  });

  it("con el interruptor apagado la comisión es cero aunque haya bps pactados", () => {
    const fee = PlatformFee.of({ amount: Money.of(10_000, "EUR"), bps: 200, enabled: false });
    expect(fee.bps).toBe(0);
    expect(fee.cents).toBe(0);
  });

  it("zero() es la comisión nula, para facturas que nunca la llevan", () => {
    const fee = PlatformFee.zero();
    expect(fee.bps).toBe(0);
    expect(fee.cents).toBe(0);
  });

  it("no admite bps fuera de 0-10000", () => {
    expect(() => PlatformFee.of({ amount: Money.of(1000, "EUR"), bps: -1 })).toThrow();
    expect(() => PlatformFee.of({ amount: Money.of(1000, "EUR"), bps: 10_001 })).toThrow();
  });

  it("no admite un tope negativo", () => {
    expect(() =>
      PlatformFee.of({ amount: Money.of(1000, "EUR"), bps: 200, capCents: -1 }),
    ).toThrow();
  });

  it("toMoney() expresa la comisión como Money en la moneda dada", () => {
    const fee = PlatformFee.of({ amount: Money.of(10_000, "EUR"), bps: 200 });
    const money = fee.toMoney("EUR");
    expect(money.cents).toBe(200);
    expect(money.currency).toBe("EUR");
  });
});
