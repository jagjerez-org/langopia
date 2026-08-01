import { describe, expect, it } from "vitest";
import { navLinksForRoles } from "./nav-links.js";

describe("navLinksForRoles (Tarea 11, Paso 1: navegación distinta según el rol)", () => {
  it("dirección (owner/admin) ve panel, analítica, candidatos, transcripciones, dominios, alumnado, calendario, contenido y correcciones", () => {
    expect(navLinksForRoles(["owner"]).map((l) => l.to)).toEqual([
      "/",
      "/analitica",
      "/candidatos",
      "/transcripciones",
      "/web/editor",
      "/web/dominios",
      "/alumnos",
      "/calendario",
      "/contenido",
      "/correcciones",
    ]);
    expect(navLinksForRoles(["admin"]).map((l) => l.to)).toEqual([
      "/",
      "/analitica",
      "/candidatos",
      "/transcripciones",
      "/web/editor",
      "/web/dominios",
      "/alumnos",
      "/calendario",
      "/contenido",
      "/correcciones",
    ]);
  });

  it("profesorado ve el alumnado, el calendario, el contenido y sus correcciones, pero no el panel de dirección", () => {
    expect(navLinksForRoles(["teacher"]).map((l) => l.to)).toEqual([
      "/alumnos",
      "/calendario",
      "/contenido",
      "/correcciones",
    ]);
  });

  it("alumnado y tutela ven únicamente las seis pantallas del portal", () => {
    expect(navLinksForRoles(["student"]).map((l) => l.to)).toEqual([
      "/mi/clases",
      "/mi/facturas",
      "/mi/asistencia",
      "/mi/progreso",
      "/mi/ejercicios",
      "/mi/repaso",
    ]);
    expect(navLinksForRoles(["guardian"]).map((l) => l.to)).toEqual([
      "/mi/clases",
      "/mi/facturas",
      "/mi/asistencia",
      "/mi/progreso",
      "/mi/ejercicios",
      "/mi/repaso",
    ]);
  });

  it("una membresía con varios roles a la vez ve la unión, sin enlaces repetidos", () => {
    const links = navLinksForRoles(["owner", "teacher"]).map((l) => l.to);
    expect(links).toEqual([
      "/",
      "/analitica",
      "/candidatos",
      "/transcripciones",
      "/web/editor",
      "/web/dominios",
      "/alumnos",
      "/calendario",
      "/contenido",
      "/correcciones",
    ]);
  });

  it("la bandeja de correcciones no se le ofrece nunca al alumnado ni a la tutela", () => {
    // Firmar una nota es del profesorado (`AttemptsController`,
    // `@Roles("owner", "admin", "teacher")`): ofrecer el enlace llevaría a un 403.
    expect(navLinksForRoles(["student"]).map((l) => l.to)).not.toContain("/correcciones");
    expect(navLinksForRoles(["guardian"]).map((l) => l.to)).not.toContain("/correcciones");
  });

  it("sin roles reconocidos, no ofrece ningún enlace que llevaría a un 403", () => {
    expect(navLinksForRoles([])).toEqual([]);
  });
});
