import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  studentActions,
  studentCreateFields,
  studentPageLabels,
  students,
} from "../../fixtures/people.js";
import { StudentPage } from "./StudentPage.js";

const baseProps = {
  students,
  createFields: studentCreateFields,
  labels: studentPageLabels,
};

describe("StudentPage", () => {
  it("muestra la lista de estudiantes con su estado", () => {
    render(<StudentPage {...baseProps} onAddStudent={() => {}} />);

    expect(screen.getByRole("heading", { name: "Estudiantes" })).toBeDefined();
    expect(screen.getByText("Ana Torres")).toBeDefined();
    expect(screen.getByText("Marta Vidal")).toBeDefined();
    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
  });

  it("buscar filtra la lista por nombre o correo", async () => {
    const user = userEvent.setup();
    render(<StudentPage {...baseProps} onAddStudent={() => {}} />);

    await user.type(screen.getByRole("searchbox", { name: "Buscar estudiante" }), "carmen");

    expect(screen.getByText("Carmen Ruiz")).toBeDefined();
    expect(screen.queryByText("Ana Torres")).toBeNull();
  });

  it("el filtro por estado muestra solo los estudiantes de ese estado", async () => {
    const user = userEvent.setup();
    render(<StudentPage {...baseProps} onAddStudent={() => {}} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "inactive");

    expect(screen.getByText("Carmen Ruiz")).toBeDefined();
    expect(screen.getByText("Jorge Prieto")).toBeDefined();
    expect(screen.queryByText("Ana Torres")).toBeNull();
  });

  it("añadir un estudiante notifica los valores del formulario", async () => {
    const user = userEvent.setup();
    const onAddStudent = vi.fn();
    render(<StudentPage {...baseProps} onAddStudent={onAddStudent} />);

    await user.click(screen.getByRole("button", { name: "Añadir estudiante" }));
    await user.type(screen.getByRole("textbox", { name: /Nombre y apellidos/ }), "Sara Molina");
    await user.type(
      screen.getByRole("textbox", { name: /Correo electrónico/ }),
      "sara.molina@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Guardar estudiante" }));

    await waitFor(() => expect(onAddStudent).toHaveBeenCalledTimes(1));
    const values = onAddStudent.mock.calls[0]![0];
    expect(values.name).toBe("Sara Molina");
    expect(values.email).toBe("sara.molina@example.com");
  });

  it("la acción de una fila notifica el id del estudiante y el de la acción", async () => {
    const user = userEvent.setup();
    const onStudentAction = vi.fn();
    render(
      <StudentPage
        {...baseProps}
        actions={studentActions}
        onAddStudent={() => {}}
        onStudentAction={onStudentAction}
      />,
    );

    // El disparador del menú toma el nombre del estudiante (fallback de ListRow).
    await user.click(screen.getByRole("button", { name: "Ana Torres" }));
    await user.click(screen.getByRole("menuitem", { name: "Dar de baja" }));

    expect(onStudentAction).toHaveBeenCalledWith("stu-01", "unenroll");
  });

  it("pulsar una fila abre la ficha del estudiante y se puede cerrar", async () => {
    const user = userEvent.setup();
    render(<StudentPage {...baseProps} onAddStudent={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Ana Torres/ }));

    const detail = screen.getByRole("complementary", { name: "Ficha del estudiante" });
    expect(detail.textContent).toContain("ana.torres@example.com");
    expect(detail.textContent).toContain("Inglés B1 — Mañanas");

    await user.click(screen.getByRole("button", { name: "Cerrar ficha" }));
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
