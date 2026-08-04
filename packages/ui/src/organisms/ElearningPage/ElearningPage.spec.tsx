import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  elearningCourses,
  elearningLessonActions,
  elearningPageLabels,
} from "../../fixtures/content.js";
import { ElearningPage } from "./ElearningPage.js";

const baseProps = {
  courses: elearningCourses,
  labels: elearningPageLabels,
};

describe("ElearningPage", () => {
  it("muestra el catálogo de cursos con su categoría y progreso", () => {
    render(<ElearningPage {...baseProps} onOpenCourse={() => {}} />);

    expect(screen.getByRole("heading", { name: "E-learning" })).toBeDefined();
    expect(screen.getByText("Gramática inglesa B1")).toBeDefined();
    expect(screen.getByText("60 % completado")).toBeDefined();
    expect(screen.getAllByText("Gramática").length).toBeGreaterThan(0);
  });

  it("el filtro por categoría muestra solo los cursos de esa categoría", async () => {
    const user = userEvent.setup();
    render(<ElearningPage {...baseProps} onOpenCourse={() => {}} />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Categoría" }),
      "Conversación",
    );

    expect(screen.getByText("Conversación: viajes")).toBeDefined();
    expect(screen.queryByText("Gramática inglesa B1")).toBeNull();
  });

  it("el buscador filtra los cursos por título", async () => {
    const user = userEvent.setup();
    render(<ElearningPage {...baseProps} onOpenCourse={() => {}} />);

    await user.type(screen.getByRole("searchbox", { name: "Buscar curso" }), "cambridge");

    expect(screen.getByText("Preparación Cambridge B2")).toBeDefined();
    expect(screen.queryByText("Conversación: viajes")).toBeNull();
  });

  it("abrir un curso muestra sus lecciones y notifica el id", async () => {
    const user = userEvent.setup();
    const onOpenCourse = vi.fn();
    render(<ElearningPage {...baseProps} onOpenCourse={onOpenCourse} />);

    await user.click(screen.getByRole("button", { name: /Gramática inglesa B1/ }));

    expect(onOpenCourse).toHaveBeenCalledWith("cou-01");
    expect(
      screen.getByRole("region", { name: "Lecciones de Gramática inglesa B1" }),
    ).toBeDefined();
    expect(screen.getByText("Present perfect")).toBeDefined();
    expect(screen.getByText("Condicionales")).toBeDefined();
    expect(screen.getAllByText("Completada").length).toBe(2);
    // El catálogo ya no está visible.
    expect(screen.queryByText("Conversación: viajes")).toBeNull();
  });

  it("la acción de una lección notifica los ids de curso, lección y acción", async () => {
    const user = userEvent.setup();
    const onLessonAction = vi.fn();
    render(
      <ElearningPage
        {...baseProps}
        lessonActions={elearningLessonActions}
        onOpenCourse={() => {}}
        onLessonAction={onLessonAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Conversación: viajes/ }));
    await user.click(screen.getByRole("button", { name: "Acciones de En el hotel" }));
    await user.click(screen.getByRole("menuitem", { name: "Marcar completada" }));

    expect(onLessonAction).toHaveBeenCalledWith("cou-02", "les-06", "toggle");
  });

  it("volver del detalle regresa al catálogo", async () => {
    const user = userEvent.setup();
    render(<ElearningPage {...baseProps} onOpenCourse={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Gramática inglesa B1/ }));
    await user.click(screen.getByRole("button", { name: "Volver al catálogo" }));

    expect(screen.getByText("Conversación: viajes")).toBeDefined();
  });
});
