import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog.js";

function renderDialog(props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  return render(
    <Dialog open onClose={() => {}} title="Baja del grupo" closeLabel="Cerrar diálogo" {...props} />,
  );
}

describe("Dialog", () => {
  it("abierto, se expone como diálogo con el título como nombre accesible", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Baja del grupo" })).toBeDefined();
  });

  it("la descripción queda enlazada con aria-describedby", () => {
    renderDialog({ description: "El alumno dejará de aparecer en la lista." });

    const dialog = screen.getByRole("dialog", { name: "Baja del grupo" });
    const descripcion = screen.getByText("El alumno dejará de aparecer en la lista.");

    expect(dialog.getAttribute("aria-describedby")).toBe(descripcion.id);
  });

  it("sin descripción no hay aria-describedby", () => {
    renderDialog();

    expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(false);
  });

  it("cerrado no aparece en el árbol de accesibilidad", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el botón de cerrar notifica onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderDialog({ onClose });

    await user.click(screen.getByRole("button", { name: "Cerrar diálogo" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("un clic fuera del panel cierra un diálogo descartable", () => {
    const onClose = vi.fn();

    renderDialog({ onClose });

    const dialog = screen.getByRole("dialog");
    // En jsdom el rectángulo del panel es 0×0: cualquier coordenada cae fuera.
    fireEvent.click(dialog, { clientX: 50, clientY: 50 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("con dismissible=false ni el clic fuera ni Escape cierran", () => {
    const onClose = vi.fn();

    renderDialog({ onClose, dismissible: false });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog, { clientX: 50, clientY: 50 });
    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);

    expect(onClose).not.toHaveBeenCalled();
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("pinta cuerpo y pie cuando se pasan", () => {
    renderDialog({
      children: <p>Contenido del formulario</p>,
      footer: <button type="button">Confirmar baja</button>,
    });

    expect(screen.getByText("Contenido del formulario")).toBeDefined();
    expect(screen.getByRole("button", { name: "Confirmar baja" })).toBeDefined();
  });
});
