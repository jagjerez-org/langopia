import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  professorActions,
  professorCreateFields,
  professors,
  professorsPageLabels,
} from "../../fixtures/people.js";
import { ProfessorsPage } from "./ProfessorsPage.js";

const baseProps = {
  professors,
  createFields: professorCreateFields,
  labels: professorsPageLabels,
};

describe("ProfessorsPage", () => {
  it("muestra la lista de profesorado con su especialidad", () => {
    render(<ProfessorsPage {...baseProps} onAddProfessor={() => {}} />);

    expect(screen.getByRole("heading", { name: "Profesorado" })).toBeDefined();
    expect(screen.getByText("Ana García")).toBeDefined();
    expect(screen.getByText(/Francés/)).toBeDefined();
  });

  it("buscar filtra la lista por nombre o especialidad", async () => {
    const user = userEvent.setup();
    render(<ProfessorsPage {...baseProps} onAddProfessor={() => {}} />);

    await user.type(screen.getByRole("searchbox", { name: "Buscar profesor" }), "laura");

    expect(screen.getByText("Laura Serra")).toBeDefined();
    expect(screen.queryByText("Ana García")).toBeNull();
  });

  it("el filtro por estado muestra solo el profesorado de ese estado", async () => {
    const user = userEvent.setup();
    render(<ProfessorsPage {...baseProps} onAddProfessor={() => {}} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "inactive");

    expect(screen.getByText("Pau Ferrer")).toBeDefined();
    expect(screen.queryByText("Ana García")).toBeNull();
  });

  it("añadir un profesor notifica los valores del formulario", async () => {
    const user = userEvent.setup();
    const onAddProfessor = vi.fn();
    render(<ProfessorsPage {...baseProps} onAddProfessor={onAddProfessor} />);

    await user.click(screen.getByRole("button", { name: "Añadir profesor" }));
    await user.type(screen.getByRole("textbox", { name: /Nombre y apellidos/ }), "Jordi Roca");
    await user.type(
      screen.getByRole("textbox", { name: /Correo electrónico/ }),
      "jordi.roca@example.com",
    );
    await user.type(screen.getByRole("textbox", { name: /Especialidad/ }), "Italiano");
    await user.click(screen.getByRole("button", { name: "Guardar profesor" }));

    await waitFor(() => expect(onAddProfessor).toHaveBeenCalledTimes(1));
    const values = onAddProfessor.mock.calls[0]![0];
    expect(values.name).toBe("Jordi Roca");
    expect(values.specialty).toBe("Italiano");
  });

  it("la acción de una fila notifica el id del profesor y el de la acción", async () => {
    const user = userEvent.setup();
    const onProfessorAction = vi.fn();
    render(
      <ProfessorsPage
        {...baseProps}
        actions={professorActions}
        onAddProfessor={() => {}}
        onProfessorAction={onProfessorAction}
      />,
    );

    // El disparador del menú toma el nombre del profesor (fallback de ListRow).
    await user.click(screen.getByRole("button", { name: "Marc Vidal" }));
    await user.click(screen.getByRole("menuitem", { name: "Dar de baja" }));

    expect(onProfessorAction).toHaveBeenCalledWith("pro-02", "deactivate");
  });
});
