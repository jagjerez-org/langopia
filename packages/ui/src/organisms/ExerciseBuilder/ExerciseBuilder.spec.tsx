import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  exerciseBuilderLabels,
  exerciseInitial,
  exerciseTypeOptions,
} from "../../fixtures/builders.js";
import { ExerciseBuilder } from "./ExerciseBuilder.js";

describe("ExerciseBuilder", () => {
  it("renderiza la definición, la lista vacía de preguntas y la vista previa", () => {
    render(<ExerciseBuilder typeOptions={exerciseTypeOptions} labels={exerciseBuilderLabels} />);

    expect(screen.getByRole("textbox", { name: "Título" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Enunciado" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Tipo de ejercicio" })).toBeDefined();
    expect(screen.getByText("Todavía no hay preguntas.")).toBeDefined();
    expect(screen.getByRole("button", { name: /Vista del alumno/ })).toBeDefined();
  });

  it("notifica onChange al editar la definición", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExerciseBuilder
        typeOptions={exerciseTypeOptions}
        labels={exerciseBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Título" }), "Repaso");

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0].title).toBe("Repaso");
  });

  it("crea una pregunta con el formulario en línea", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExerciseBuilder
        typeOptions={exerciseTypeOptions}
        labels={exerciseBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Añadir pregunta" }));
    await user.type(screen.getByRole("textbox", { name: "Pregunta" }), "¿Capital de Francia?");
    await user.type(screen.getByRole("textbox", { name: "Respuesta" }), "París");
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));

    // Aparece en la lista de preguntas y en la vista previa.
    expect(screen.getAllByText("¿Capital de Francia?").length).toBeGreaterThan(0);
    const exercise = onChange.mock.calls.at(-1)![0];
    expect(exercise.questions).toHaveLength(1);
    expect(exercise.questions[0].answer).toBe("París");
  });

  it("edita una pregunta existente", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExerciseBuilder
        typeOptions={exerciseTypeOptions}
        initialExercise={exerciseInitial}
        labels={exerciseBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Acciones de Escribe la traducción de «ventana»." }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));

    const promptInput = screen.getByRole("textbox", { name: "Pregunta" });
    expect(promptInput).toHaveProperty("value", "Escribe la traducción de «ventana».");

    await user.clear(promptInput);
    await user.type(promptInput, "Traduce «puerta».");
    await user.click(screen.getByRole("button", { name: "Guardar pregunta" }));

    // Aparece en la lista de preguntas y en la vista previa.
    expect(screen.getAllByText("Traduce «puerta».").length).toBeGreaterThan(0);
    const exercise = onChange.mock.calls.at(-1)![0];
    expect(exercise.questions[1].prompt).toBe("Traduce «puerta».");
  });

  it("elimina una pregunta", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExerciseBuilder
        typeOptions={exerciseTypeOptions}
        initialExercise={exerciseInitial}
        labels={exerciseBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Acciones de ¿Qué palabra significa «cocina»?" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    expect(screen.queryByText("¿Qué palabra significa «cocina»?")).toBeNull();
    expect(onChange.mock.calls.at(-1)![0].questions).toHaveLength(1);
  });

  it("guarda el ejercicio completo con onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ExerciseBuilder
        typeOptions={exerciseTypeOptions}
        initialExercise={exerciseInitial}
        labels={exerciseBuilderLabels}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar ejercicio" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toEqual(exerciseInitial);
  });

  it("la vista previa muestra el título y las preguntas como las vería el alumno", () => {
    render(
      <ExerciseBuilder
        typeOptions={exerciseTypeOptions}
        initialExercise={exerciseInitial}
        labels={exerciseBuilderLabels}
      />,
    );

    const preview = screen.getByRole("button", { name: /Vista del alumno/ }).closest("section")!;
    const scope = within(preview);
    expect(scope.getByRole("heading", { name: "Vocabulario de la casa" })).toBeDefined();
    expect(scope.getByText("Opción múltiple")).toBeDefined();
    expect(scope.getByText("Escribe la traducción de «ventana».")).toBeDefined();
  });
});
