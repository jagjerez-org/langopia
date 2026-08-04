import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Selector } from "./Selector.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán", disabled: true },
];

describe("Selector", () => {
  it("renderiza un combobox nativo con etiqueta y opciones", () => {
    render(<Selector label="Idioma" options={OPTIONS} />);

    const select = screen.getByRole("combobox", { name: "Idioma" });

    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByRole("option", { name: "Español" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Alemán" }).hasAttribute("disabled")).toBe(true);
  });

  it("muestra el placeholder como opción deshabilitada y vacía", () => {
    render(<Selector label="Idioma" options={OPTIONS} placeholder="Elige un idioma" />);

    const placeholder = screen.getByRole("option", { name: "Elige un idioma" });

    expect(placeholder.getAttribute("value")).toBe("");
    expect(placeholder.hasAttribute("disabled")).toBe(true);
  });

  it("el placeholder queda seleccionado por defecto en vez de la primera opción", () => {
    // Un <select> nativo salta la primera opción disabled: el componente
    // fuerza defaultValue="" para que el placeholder sea visible.
    render(<Selector label="Idioma" options={OPTIONS} placeholder="Elige un idioma" />);

    const select = screen.getByRole("combobox", { name: "Idioma" }) as HTMLSelectElement;

    expect(select.value).toBe("");
  });

  it("defaultValue explícito gana al placeholder", () => {
    render(<Selector label="Idioma" options={OPTIONS} placeholder="Elige un idioma" defaultValue="en" />);

    const select = screen.getByRole("combobox", { name: "Idioma" }) as HTMLSelectElement;

    expect(select.value).toBe("en");
  });

  it("notifica onChange al elegir una opción", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Selector label="Idioma" options={OPTIONS} onChange={onChange} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Idioma" }), "en");

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("funciona controlado con value", () => {
    render(<Selector label="Idioma" options={OPTIONS} value="en" onChange={() => {}} />);

    const select = screen.getByRole("combobox", { name: "Idioma" }) as HTMLSelectElement;

    expect(select.value).toBe("en");
  });

  it("el hint se enlaza con aria-describedby y desaparece si hay error", () => {
    const { rerender } = render(<Selector label="Idioma" options={OPTIONS} hint="Idioma principal" />);

    const select = screen.getByRole("combobox", { name: "Idioma" });
    expect(select.getAttribute("aria-describedby")).toContain("-hint");

    rerender(<Selector label="Idioma" options={OPTIONS} hint="Idioma principal" error="Obligatorio" />);

    expect(screen.queryByText("Idioma principal")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Obligatorio");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.getAttribute("aria-describedby")).toContain("-error");
    expect(select.getAttribute("aria-describedby")).not.toContain("-hint");
  });

  it("isLoading deshabilita el control y fija aria-busy", () => {
    render(<Selector label="Idioma" options={OPTIONS} isLoading />);

    const select = screen.getByRole("combobox", { name: "Idioma" });

    expect(select.hasAttribute("disabled")).toBe(true);
    expect(select.getAttribute("aria-busy")).toBe("true");
  });

  it("required marca la etiqueta y el control", () => {
    render(<Selector label="Idioma" options={OPTIONS} required />);

    expect(screen.getByRole("combobox", { name: /Idioma/ }).getAttribute("aria-required")).toBe("true");
  });

  it("reenvía la ref al elemento select", () => {
    const ref = createRef<HTMLSelectElement>();

    render(<Selector ref={ref} label="Idioma" options={OPTIONS} />);

    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
