import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { SelectorWithSearch } from "./SelectorWithSearch.js";

const OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán" },
  { value: "gl", label: "Galego", disabled: true },
];

function renderSelector(props: Partial<Parameters<typeof SelectorWithSearch>[0]> = {}) {
  return render(
    <SelectorWithSearch
      label="Idioma"
      options={OPTIONS}
      noResultsLabel="Sin resultados"
      {...props}
    />,
  );
}

describe("SelectorWithSearch", () => {
  it("renderiza un combobox cerrado con su etiqueta", () => {
    renderSelector();

    const combobox = screen.getByRole("combobox", { name: "Idioma" });

    expect(combobox.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("al enfocar abre el listbox con todas las opciones", async () => {
    const user = userEvent.setup();
    renderSelector();

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);

    expect(combobox.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox")).toBeDefined();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("teclear filtra las opciones y muestra el texto de sin resultados", async () => {
    const user = userEvent.setup();
    renderSelector();

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);
    await user.keyboard("ing");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Inglés" })).toBeDefined();

    await user.keyboard("xxx");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Sin resultados")).toBeDefined();
  });

  it("click en una opción la selecciona, cierra y muestra su texto", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Alemán" }));

    expect(onChange).toHaveBeenCalledWith("de");
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
    expect((combobox as HTMLInputElement).value).toBe("Alemán");
  });

  it("teclado: ↓ abre, mueve la activa y Enter la elige", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    combobox.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");

    expect(combobox.getAttribute("aria-activedescendant")).toContain("-option-en");

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("en");
    expect((combobox as HTMLInputElement).value).toBe("Inglés");
  });

  it("teclado: ↑ sube la opción activa sin pasar del principio", async () => {
    const user = userEvent.setup();
    renderSelector();

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    combobox.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");

    expect(combobox.getAttribute("aria-activedescendant")).toContain("-option-es");
  });

  it("Escape cierra sin cambiar la selección", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange, defaultValue: "es" });

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    expect((combobox as HTMLInputElement).value).toBe("Español");

    await user.click(combobox);
    await user.keyboard("ing");
    await user.keyboard("{Escape}");

    expect(combobox.getAttribute("aria-expanded")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();
    expect((combobox as HTMLInputElement).value).toBe("Español");
  });

  it("Enter sobre una opción deshabilitada no la elige", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);
    await user.keyboard("gal");
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("controlado: no cambia por sí solo, solo notifica", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ value: "es", onChange });

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Inglés" }));

    expect(onChange).toHaveBeenCalledWith("en");
    // El padre no actualizó `value`: el texto sigue siendo el de "es".
    expect((combobox as HTMLInputElement).value).toBe("Español");
  });

  it("funciona como componente controlado de verdad", async () => {
    const user = userEvent.setup();

    function Wrapper() {
      const [value, setValue] = useState<string>("es");
      return (
        <SelectorWithSearch
          label="Idioma"
          options={OPTIONS}
          noResultsLabel="Sin resultados"
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Wrapper />);

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Inglés" }));

    expect((combobox as HTMLInputElement).value).toBe("Inglés");
  });

  it("muestra hint y lo sustituye por el error", () => {
    const { rerender } = render(
      <SelectorWithSearch label="Idioma" options={OPTIONS} noResultsLabel="Sin resultados" hint="El principal" />,
    );

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    expect(combobox.getAttribute("aria-describedby")).toContain("-hint");

    rerender(
      <SelectorWithSearch
        label="Idioma"
        options={OPTIONS}
        noResultsLabel="Sin resultados"
        hint="El principal"
        error="Obligatorio"
      />,
    );

    expect(screen.queryByText("El principal")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Obligatorio");
    expect(combobox.getAttribute("aria-invalid")).toBe("true");
  });

  it("disabled impide abrir la lista", async () => {
    const user = userEvent.setup();
    renderSelector({ disabled: true });

    const combobox = screen.getByRole("combobox", { name: "Idioma" });
    await user.click(combobox);

    expect(combobox.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("reenvía la ref al elemento input", () => {
    const ref = createRef<HTMLInputElement>();
    renderSelector({ ref });

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
