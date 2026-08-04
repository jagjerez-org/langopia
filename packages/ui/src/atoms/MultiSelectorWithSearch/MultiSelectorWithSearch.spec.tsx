import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { MultiSelectorWithSearch } from "./MultiSelectorWithSearch.js";
import type { SelectorWithSearchOption } from "../SelectorWithSearch/SelectorWithSearch.js";

const OPTIONS: SelectorWithSearchOption[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "de", label: "Alemán" },
  { value: "gl", label: "Galego", disabled: true },
];

function renderSelector(props: Partial<Parameters<typeof MultiSelectorWithSearch>[0]> = {}) {
  return render(
    <MultiSelectorWithSearch
      label="Idiomas"
      options={OPTIONS}
      noResultsLabel="Sin resultados"
      getRemoveLabel={(option) => `Quitar ${option.label}`}
      {...props}
    />,
  );
}

describe("MultiSelectorWithSearch", () => {
  it("renderiza un combobox con su etiqueta y listbox multiseleccionable al abrir", async () => {
    const user = userEvent.setup();
    renderSelector();

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    expect(combobox.getAttribute("aria-expanded")).toBe("false");

    await user.click(combobox);

    expect(combobox.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBe("true");
  });

  it("click en una opción la convierte en chip y la saca de la lista", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Inglés" }));

    expect(onChange).toHaveBeenCalledWith(["en"]);
    // La lista sigue abierta, pero ya sin la opción elegida.
    expect(screen.getByRole("listbox")).toBeDefined();
    expect(screen.queryByRole("option", { name: "Inglés" })).toBeNull();
    // El campo queda limpio para seguir buscando.
    expect((combobox as HTMLInputElement).value).toBe("");
  });

  it("teclear filtra y muestra el texto de sin resultados", async () => {
    const user = userEvent.setup();
    renderSelector();

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.keyboard("ing");

    expect(screen.getAllByRole("option")).toHaveLength(1);

    await user.keyboard("zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Sin resultados")).toBeDefined();
  });

  it("teclado: ↓ mueve la activa y Enter la añade", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    combobox.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");

    expect(combobox.getAttribute("aria-activedescendant")).toContain("-option-en");

    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith(["en"]);
    expect(screen.getByRole("button", { name: "Quitar Inglés" })).toBeDefined();
  });

  it("Enter sobre una opción deshabilitada no la añade", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.keyboard("gal");
    await user.keyboard("{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("el botón del chip quita la selección", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ defaultValue: ["es", "en"], onChange });

    await user.click(screen.getByRole("button", { name: "Quitar Español" }));

    expect(onChange).toHaveBeenCalledWith(["en"]);
  });

  it("Retroceso con el campo vacío quita la última selección", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ defaultValue: ["es", "en"], onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    combobox.focus();
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith(["es"]);
  });

  it("Retroceso con texto en el campo no quita selecciones", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ defaultValue: ["es"], onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.keyboard("a");
    await user.keyboard("{Backspace}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("Escape cierra la lista sin cambiar la selección", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("controlado: no cambia por sí solo, solo notifica", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSelector({ value: ["es"], onChange });

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Inglés" }));

    expect(onChange).toHaveBeenCalledWith(["es", "en"]);
    // El padre no actualizó `value`: no aparece el chip de Inglés.
    expect(screen.queryByRole("button", { name: "Quitar Inglés" })).toBeNull();
  });

  it("funciona como componente controlado de verdad", async () => {
    const user = userEvent.setup();

    function Wrapper() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <MultiSelectorWithSearch
          label="Idiomas"
          options={OPTIONS}
          noResultsLabel="Sin resultados"
          getRemoveLabel={(option) => `Quitar ${option.label}`}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Wrapper />);

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Alemán" }));

    expect(screen.getByRole("button", { name: "Quitar Alemán" })).toBeDefined();
  });

  it("disabled bloquea el campo y los botones de quitar", () => {
    renderSelector({ defaultValue: ["es"], disabled: true });

    expect(screen.getByRole("combobox", { name: "Idiomas" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Quitar Español" }).hasAttribute("disabled")).toBe(true);
  });

  it("muestra hint y lo sustituye por el error", () => {
    const { rerender } = render(
      <MultiSelectorWithSearch
        label="Idiomas"
        options={OPTIONS}
        noResultsLabel="Sin resultados"
        getRemoveLabel={(option) => `Quitar ${option.label}`}
        hint="Los que imparte"
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Idiomas" });
    expect(combobox.getAttribute("aria-describedby")).toContain("-hint");

    rerender(
      <MultiSelectorWithSearch
        label="Idiomas"
        options={OPTIONS}
        noResultsLabel="Sin resultados"
        getRemoveLabel={(option) => `Quitar ${option.label}`}
        hint="Los que imparte"
        error="Elige al menos uno"
      />,
    );

    expect(screen.queryByText("Los que imparte")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Elige al menos uno");
    expect(combobox.getAttribute("aria-invalid")).toBe("true");
  });

  it("reenvía la ref al elemento input", () => {
    const ref = createRef<HTMLInputElement>();
    renderSelector({ ref });

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
