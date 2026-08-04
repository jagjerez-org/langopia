import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListRow } from "./ListRow.js";
import { listRowBase } from "../../fixtures/lists.js";

describe("ListRow", () => {
  it("renderiza título, subtítulo, tags y avatar", () => {
    render(<ListRow {...listRowBase} />);

    expect(screen.getByText("Informe anual 2025")).toBeDefined();
    expect(screen.getByText("Actualizado hace 2 días")).toBeDefined();
    expect(screen.getByText("Revisión")).toBeDefined();
    expect(screen.getByText("Prioritario")).toBeDefined();
    expect(screen.getByRole("img", { name: "Ana Torres" })).toBeDefined();
  });

  it("con href la fila es un enlace", () => {
    render(<ListRow title="Informe anual 2025" href="/documentos/1" />);

    expect(screen.getByRole("link", { name: "Informe anual 2025" }).getAttribute("href")).toBe(
      "/documentos/1",
    );
  });

  it("con onClick la fila es un botón y notifica la pulsación", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ListRow title="Informe anual 2025" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Informe anual 2025" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("las acciones se abren con TreeDots y ejecutan su onClick", async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(
      <ListRow
        title="Informe anual 2025"
        actions={[{ label: "Duplicar", onClick: onDuplicate }, { label: "Ver", href: "/doc/1" }]}
        actionsLabel="Acciones de Informe anual 2025"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Acciones de Informe anual 2025" }));
    const duplicate = screen.getByRole("menuitem", { name: "Duplicar" });
    await user.click(duplicate);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menuitem", { name: "Ver" }).getAttribute("href")).toBe("/doc/1");
  });

  it("la fila clickable y el menú de acciones no se anidan", () => {
    render(
      <ListRow
        title="Informe anual 2025"
        onClick={() => {}}
        actions={[{ label: "Duplicar" }]}
        actionsLabel="Acciones de Informe anual 2025"
      />,
    );

    const row = screen.getByRole("button", { name: "Informe anual 2025" });
    const trigger = screen.getByRole("button", { name: "Acciones de Informe anual 2025" });
    expect(row.contains(trigger)).toBe(false);
  });
});
