import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetPendingGeneration,
  readPendingGeneration,
  rememberPendingGeneration,
} from "./pending-generation.js";

describe("pending-generation (Tarea 11 de la ola 2, Paso 2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sin nada guardado, no hay generación pendiente que avisar", () => {
    expect(readPendingGeneration()).toBeNull();
  });

  it("recuerda el código y el instante de arranque entre recargas", () => {
    rememberPendingGeneration({ code: "ES-B1-U7", startedAt: "2026-07-28T09:00:00.000Z" });

    expect(readPendingGeneration()).toEqual({
      code: "ES-B1-U7",
      startedAt: "2026-07-28T09:00:00.000Z",
    });
  });

  it("olvidarla la borra: la generación ya terminó y no hay nada que explicar", () => {
    rememberPendingGeneration({ code: "ES-B1-U7", startedAt: "2026-07-28T09:00:00.000Z" });

    forgetPendingGeneration();

    expect(readPendingGeneration()).toBeNull();
  });

  it("un contenido corrupto se ignora en silencio, no rompe la pantalla", () => {
    localStorage.setItem("langopia:content:pending-generation", "{no es json");

    expect(readPendingGeneration()).toBeNull();
  });

  it("un objeto sin los dos campos tampoco vale como aviso", () => {
    localStorage.setItem("langopia:content:pending-generation", JSON.stringify({ code: "ES-B1-U7" }));

    expect(readPendingGeneration()).toBeNull();
  });
});
