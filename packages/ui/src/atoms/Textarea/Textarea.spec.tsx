import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Textarea } from "./Textarea.js";

describe("Textarea", () => {
  it("asocia la etiqueta con el control multilínea", () => {
    render(<Textarea label="Observaciones" />);

    const textarea = screen.getByLabelText("Observaciones");

    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("rows")).toBe("3");
  });

  it("respeta rows explícito", () => {
    render(<Textarea label="Notas" rows={6} />);

    expect(screen.getByLabelText("Notas").getAttribute("rows")).toBe("6");
  });

  it("marca required con aria-required", () => {
    render(<Textarea label="Motivo" required />);

    expect(screen.getByLabelText(/Motivo/).getAttribute("aria-required")).toBe("true");
  });

  it("muestra el hint y lo enlaza con aria-describedby", () => {
    render(<Textarea label="Comentario" hint="Máximo 500 caracteres" />);

    const textarea = screen.getByLabelText("Comentario");
    const hintId = textarea.getAttribute("aria-describedby");

    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId!)?.textContent).toBe("Máximo 500 caracteres");
  });

  it("el error sustituye al hint, fija aria-invalid y role=alert", () => {
    render(<Textarea label="Bio" hint="Ayuda" error="Texto demasiado largo" />);

    const textarea = screen.getByLabelText(/Bio/);

    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Texto demasiado largo");
    expect(screen.queryByText("Ayuda")).toBeNull();
  });

  it("acepta texto multilínea", async () => {
    const user = userEvent.setup();

    render(<Textarea label="Mensaje" />);

    const textarea = screen.getByLabelText("Mensaje");
    await user.type(textarea, "Línea uno{enter}Línea dos");

    expect((textarea as HTMLTextAreaElement).value).toBe("Línea uno\nLínea dos");
  });

  it("reenvía la ref al elemento textarea", () => {
    const ref = createRef<HTMLTextAreaElement>();

    render(<Textarea label="Con ref" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
