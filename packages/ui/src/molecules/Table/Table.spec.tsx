import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Table } from "./Table.js";
import type { TableColumn } from "./Table.js";

interface Fila {
  id: string;
  nombre: string;
  horas: number;
}

const columnas: TableColumn<Fila>[] = [
  { key: "nombre", header: "Nombre", render: (fila) => fila.nombre },
  { key: "horas", header: "Horas", numeric: true, render: (fila) => String(fila.horas) },
];

const filas: Fila[] = [
  { id: "1", nombre: "Ana", horas: 12 },
  { id: "2", nombre: "Bruno", horas: 8 },
];

function renderTabla(props: Partial<Parameters<typeof Table<Fila>>[0]> = {}) {
  return render(
    <Table<Fila>
      columns={columnas}
      rows={filas}
      getRowKey={(fila) => fila.id}
      caption="Alumnos del grupo B2"
      {...props}
    />,
  );
}

describe("Table", () => {
  it("pinta una tabla semántica con leyenda y cabeceras de columna", () => {
    renderTabla();

    const tabla = screen.getByRole("table", { name: "Alumnos del grupo B2" });
    const cabeceras = within(tabla).getAllByRole("columnheader");

    expect(cabeceras.map((th) => [th.textContent, th.getAttribute("scope")])).toEqual([
      ["Nombre", "col"],
      ["Horas", "col"],
    ]);
    expect(within(tabla).getByRole("cell", { name: "Ana" })).toBeDefined();
    expect(within(tabla).getByRole("cell", { name: "12" }).getAttribute("data-numeric")).toBe("true");
  });

  it("puede ocultar la leyenda visualmente sin quitarla del nombre accesible", () => {
    renderTabla({ captionVisuallyHidden: true });

    expect(screen.getByRole("table", { name: "Alumnos del grupo B2" })).toBeDefined();
  });

  it("en carga marca aria-busy y pinta filas de esqueleto", () => {
    renderTabla({ isLoading: true, skeletonRowCount: 3, rows: [] });

    const tabla = screen.getByRole("table", { name: "Alumnos del grupo B2" });

    expect(tabla.getAttribute("aria-busy")).toBe("true");
    expect(within(tabla).getAllByRole("row")).toHaveLength(1 + 3); // cabecera + esqueletos
  });

  it("sin filas pinta el estado vacío", () => {
    renderTabla({ rows: [], emptyState: <p>Nada por aquí</p> });

    expect(screen.getByText("Nada por aquí")).toBeDefined();
  });

  it("el error tiene prioridad sobre la carga y el vacío", () => {
    renderTabla({
      isLoading: true,
      rows: [],
      emptyState: <p>Nada por aquí</p>,
      error: <p>Falló la carga</p>,
    });

    expect(screen.getByText("Falló la carga")).toBeDefined();
    expect(screen.queryByText("Nada por aquí")).toBeNull();
    expect(screen.getByRole("table", { name: "Alumnos del grupo B2" }).getAttribute("aria-busy")).toBe("true");
  });
});
