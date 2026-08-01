import { describe, expect, it } from "vitest";
import { HourlyRate } from "./hourly-rate.vo.js";

/**
 * Tramos reales del mercado (italki, Preply, julio 2026), en céntimos por
 * hora: community 4-15 €, professional 15-40 €, specialist 30-75 €. Los casos
 * válidos usan a propósito el límite de cada tramo, para probar que el borde
 * es inclusivo y no solo el centro del rango.
 */
describe("HourlyRate", () => {
  it("acepta el límite inferior del tramo community (4 €/h)", () => {
    const rate = HourlyRate.of("community", 400);
    expect(rate.cents).toBe(400);
    expect(rate.tier).toBe("community");
  });

  it("rechaza una tarifa community por encima de 15 €/h", () => {
    expect(() => HourlyRate.of("community", 1600)).toThrow(/tramo/i);
  });

  it("acepta el límite superior del tramo professional (40 €/h)", () => {
    const rate = HourlyRate.of("professional", 4000);
    expect(rate.cents).toBe(4000);
  });

  it("rechaza una tarifa professional por debajo de 15 €/h", () => {
    expect(() => HourlyRate.of("professional", 1400)).toThrow(/tramo/i);
  });

  it("acepta una tarifa specialist dentro del tramo (50 €/h)", () => {
    const rate = HourlyRate.of("specialist", 5000);
    expect(rate.cents).toBe(5000);
  });

  it("rechaza una tarifa specialist por encima de 75 €/h", () => {
    expect(() => HourlyRate.of("specialist", 7600)).toThrow(/tramo/i);
  });
});
