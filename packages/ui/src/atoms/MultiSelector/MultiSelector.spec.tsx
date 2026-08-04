import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { MultiSelector } from "./MultiSelector.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán", hint: "Solo mañanas" },
  { value: "pt", label: "Portugués", disabled: true },
];

describe("MultiSelector", () => {
  it("renderiza un grupo con nombre accesible y un checkbox por opción", () => {
    render(<MultiSelector label="Idiomas" options={OPTIONS} />);

    expect(screen.getByRole("group", { name: "Idiomas" })).toBeDefined();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    expect(screen.getByRole("checkbox", { name: "Portugués" }).hasAttribute("disabled")).toBe(true);
  });

  it("no controlado: marca y desmarca con click y notifica la lista completa", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MultiSelector label="Idiomas" options={OPTIONS} onChange={onChange} />);

    const es = screen.getByRole("checkbox", { name: "Español" });
    const en = screen.getByRole("checkbox", { name: "Inglés" });

    await user.click(es);
    expect(onChange).toHaveBeenLastCalledWith(["es"]);

    await user.click(en);
    expect(onChange).toHaveBeenLastCalledWith(["es", "en"]);

    await user.click(es);
    expect(onChange).toHaveBeenLastCalledWith(["en"]);
  });

  it("no controlado: respeta defaultValue", () => {
    render(<MultiSelector label="Idiomas" options={OPTIONS} defaultValue={["en"]} />);

    expect((screen.getByRole("checkbox", { name: "Inglés" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Español" }) as HTMLInputElement).checked).toBe(false);
  });

  it("controlado: no cambia por sí solo, solo notifica", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MultiSelector label="Idiomas" options={OPTIONS} value={["es"]} onChange={onChange} />);

    const en = screen.getByRole("checkbox", { name: "Inglés" }) as HTMLInputElement;
    await user.click(en);

    expect(onChange).toHaveBeenCalledWith(["es", "en"]);
    // Sigue desmarcado: el padre decide si actualiza `value`.
    expect(en.checked).toBe(false);
  });

  it("se acciona con teclado (Espacio)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MultiSelector label="Idiomas" options={OPTIONS} onChange={onChange} />);

    screen.getByRole("checkbox", { name: "Español" }).focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledWith(["es"]);
  });

  it("disabled global bloquea todas las opciones", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MultiSelector label="Idiomas" options={OPTIONS} onChange={onChange} disabled />);

    await user.click(screen.getByRole("checkbox", { name: "Español" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("la opción deshabilitada no notifica cambios", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<MultiSelector label="Idiomas" options={OPTIONS} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Portugués" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra hint del grupo y lo sustituye por el error", () => {
    const { rerender } = render(<MultiSelector label="Idiomas" options={OPTIONS} hint="Elige varios" />);

    const group = screen.getByRole("group", { name: "Idiomas" });
    expect(group.getAttribute("aria-describedby")).toContain("-hint");

    rerender(<MultiSelector label="Idiomas" options={OPTIONS} hint="Elige varios" error="Elige al menos uno" />);

    expect(screen.queryByText("Elige varios")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Elige al menos uno");
  });

  it("muestra el hint de cada opción", () => {
    render(<MultiSelector label="Idiomas" options={OPTIONS} />);

    expect(screen.getByText("Solo mañanas")).toBeDefined();
  });

  it("propaga name a los checkboxes para envío de formulario", () => {
    render(<MultiSelector label="Idiomas" options={OPTIONS} name="languages" />);

    expect(screen.getByRole("checkbox", { name: "Español" }).getAttribute("name")).toBe("languages");
  });

  it("reenvía la ref al contenedor del campo", () => {
    const ref = createRef<HTMLDivElement>();

    render(<MultiSelector ref={ref} label="Idiomas" options={OPTIONS} />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
