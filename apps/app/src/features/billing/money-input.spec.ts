import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./money-input.js";

describe("parseMoneyInput (Tarea 10, Paso 3)", () => {
  it("un entero se convierte en céntimos exactos", () => {
    expect(parseMoneyInput("150")).toBe(15_000);
  });

  it("acepta coma decimal", () => {
    expect(parseMoneyInput("150,50")).toBe(15_050);
  });

  it("acepta punto decimal", () => {
    expect(parseMoneyInput("150.5")).toBe(15_050);
  });

  it("acepta cero", () => {
    expect(parseMoneyInput("0")).toBe(0);
  });

  it("rechaza un texto que no es un número", () => {
    expect(parseMoneyInput("abc")).toBeNull();
  });

  it("rechaza un negativo", () => {
    expect(parseMoneyInput("-10")).toBeNull();
  });

  it("rechaza más de dos decimales", () => {
    expect(parseMoneyInput("10.123")).toBeNull();
  });

  it("rechaza una cadena vacía", () => {
    expect(parseMoneyInput("")).toBeNull();
  });
});
