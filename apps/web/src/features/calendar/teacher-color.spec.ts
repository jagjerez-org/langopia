import { describe, expect, it } from "vitest";
import { TEACHER_COLOR_COUNT, teacherColorIndex } from "./teacher-color.js";

describe("teacherColorIndex", () => {
  it("el mismo profesor siempre obtiene el mismo color", () => {
    const id = "33333333-3333-3333-3333-333333333333";
    expect(teacherColorIndex(id)).toBe(teacherColorIndex(id));
  });

  it("profesores distintos tienden a obtener colores distintos", () => {
    const colors = new Set(
      [
        "a3f1c2d4-carla-ruiz",
        "b7e2d391-dan-whitfield",
        "c918aa02-sofia-mancini",
        "de44f710-yuki-tanaka",
      ].map(teacherColorIndex),
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("el índice siempre cae dentro de la paleta", () => {
    for (const id of ["a", "bb", "ccc", "dddd", "eeeee"]) {
      const index = teacherColorIndex(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(TEACHER_COLOR_COUNT);
    }
  });

  it("sin profesor asignado (null) no tiene color de profesor", () => {
    expect(teacherColorIndex(null)).toBeNull();
  });
});
