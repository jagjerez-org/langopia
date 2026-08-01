import { describe, expect, it } from "vitest";
import { Money } from "./money.vo.js";

describe("Money", () => {
  it("suma dos importes de la misma moneda", () => {
    const total = Money.of(1000, "EUR").add(Money.of(500, "EUR"));
    expect(total.cents).toBe(1500);
    expect(total.currency).toBe("EUR");
  });

  it("resta dos importes de la misma moneda", () => {
    const remaining = Money.of(1000, "EUR").subtract(Money.of(300, "EUR"));
    expect(remaining.cents).toBe(700);
  });

  it("no deja sumar monedas distintas", () => {
    expect(() => Money.of(1000, "EUR").add(Money.of(500, "USD"))).toThrow(/moneda/);
    try {
      Money.of(1000, "EUR").add(Money.of(500, "USD"));
    } catch (error) {
      expect((error as { code: string }).code).toBe("currency_mismatch");
      expect((error as { kind: string }).kind).toBe("invalid_input");
    }
  });

  it("no deja restar monedas distintas", () => {
    expect(() => Money.of(1000, "EUR").subtract(Money.of(500, "USD"))).toThrow();
  });

  it("no admite un importe negativo al construirse", () => {
    expect(() => Money.of(-100, "EUR")).toThrow();
    try {
      Money.of(-100, "EUR");
    } catch (error) {
      expect((error as { code: string }).code).toBe("invalid_money_amount");
      expect((error as { kind: string }).kind).toBe("invalid_input");
    }
  });

  it("no admite restar un importe mayor que el que hay: el resultado sería negativo", () => {
    expect(() => Money.of(300, "EUR").subtract(Money.of(1000, "EUR"))).toThrow();
  });

  it("no admite céntimos que no sean un entero", () => {
    expect(() => Money.of(10.5, "EUR")).toThrow();
  });

  it("normaliza el código de moneda a mayúsculas", () => {
    expect(Money.of(100, "eur").currency).toBe("EUR");
  });

  it("zero() crea el importe nulo de una moneda", () => {
    expect(Money.zero("EUR").cents).toBe(0);
  });

  it("dos importes iguales son iguales por valor", () => {
    expect(Money.of(100, "EUR").equals(Money.of(100, "EUR"))).toBe(true);
    expect(Money.of(100, "EUR").equals(Money.of(200, "EUR"))).toBe(false);
  });

  it("compara importes de la misma moneda", () => {
    expect(Money.of(200, "EUR").isGreaterThan(Money.of(100, "EUR"))).toBe(true);
    expect(Money.of(100, "EUR").isGreaterThan(Money.of(100, "EUR"))).toBe(false);
    expect(Money.of(100, "EUR").isGreaterThanOrEqual(Money.of(100, "EUR"))).toBe(true);
  });
});
