import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List } from "./List.js";
import { listItems, listSortOptions } from "../../fixtures/lists.js";

function renderList(props: Partial<Parameters<typeof List>[0]> = {}) {
  return render(<List items={listItems} ariaLabel="Documentos" {...props} />);
}

describe("List", () => {
  it("renderiza la región con nombre accesible y las filas como lista", () => {
    renderList();

    expect(screen.getByRole("region", { name: "Documentos" })).toBeDefined();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(listItems.length);
    expect(screen.getByText("Informe anual 2025")).toBeDefined();
  });

  it("filtra por título o subtítulo con el buscador y avisa por callback", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    renderList({ searchLabel: "Buscar", searchPlaceholder: "Escribe para filtrar", onSearchChange });

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "presupuesto");

    expect(screen.getByText("Propuesta de presupuesto")).toBeDefined();
    expect(screen.queryByText("Informe anual 2025")).toBeNull();
    expect(onSearchChange).toHaveBeenLastCalledWith("presupuesto");
  });

  it("ordena alfabéticamente por el campo elegido y avisa por callback", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderList({ sortLabel: "Ordenar por", sortOptions: listSortOptions, onSortChange });

    await user.selectOptions(screen.getByRole("combobox", { name: "Ordenar por" }), "title");

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]!.textContent).toContain("Acta de la reunión de junio");
    expect(onSortChange).toHaveBeenCalledWith("title");
  });

  it("pagina con anterior/siguiente, muestra la info y avisa por callback", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderList({ pageSize: 3, onPageChange });

    expect(screen.getByText("1 de 3")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Anterior" })).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("2 de 3")).toBeDefined();
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    // En la última página no avanza más.
    expect(screen.getByText("3 de 3")).toBeDefined();
    expect(screen.getByRole("button", { name: "Siguiente" })).toHaveProperty("disabled", true);
  });

  it("la búsqueda vuelve a la primera página", async () => {
    const user = userEvent.setup();
    renderList({ searchLabel: "Buscar", pageSize: 3 });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("2 de 3")).toBeDefined();

    await user.type(screen.getByRole("searchbox", { name: "Buscar" }), "a");
    expect(screen.getByText("1 de 3")).toBeDefined();
  });

  it("ejecuta la acción de una fila desde su menú", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const items = [
      {
        id: "doc-1",
        title: "Informe anual 2025",
        actions: [{ label: "Duplicar", onClick: onDuplicate }],
      },
    ];
    renderList({ items, rowActionsLabel: "Acciones de la fila" });

    await user.click(screen.getByRole("button", { name: "Acciones de la fila" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("muestra el estado vacío cuando no hay resultados", () => {
    renderList({ items: [], emptyLabel: "Sin documentos" });

    expect(screen.getByText("Sin documentos")).toBeDefined();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("muestra el estado de carga con texto por props", () => {
    renderList({ isLoading: true, loadingLabel: "Cargando documentos…" });

    expect(screen.getByRole("status").textContent).toBe("Cargando documentos…");
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
