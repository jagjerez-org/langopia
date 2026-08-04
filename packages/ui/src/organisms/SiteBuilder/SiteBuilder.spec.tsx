import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  siteBuilderAvailableBlocks,
  siteBuilderInitialBlocks,
  siteBuilderLabels,
} from "../../fixtures/builders.js";
import { SiteBuilder } from "./SiteBuilder.js";

describe("SiteBuilder", () => {
  it("renderiza el catálogo y el lienzo vacío", () => {
    render(
      <SiteBuilder availableBlocks={siteBuilderAvailableBlocks} labels={siteBuilderLabels} />,
    );

    expect(screen.getByRole("button", { name: /Bloques disponibles/ })).toBeDefined();
    expect(screen.getByRole("region", { name: "Lienzo" })).toBeDefined();
    expect(screen.getByText("Añade bloques del catálogo para montar la página.")).toBeDefined();
  });

  it("añade un bloque del catálogo al lienzo y notifica onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SiteBuilder
        availableBlocks={siteBuilderAvailableBlocks}
        labels={siteBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Galería/ }));

    const canvas = within(screen.getByRole("region", { name: "Lienzo" }));
    expect(canvas.getByText("Galería")).toBeDefined();
    expect(onChange).toHaveBeenCalledTimes(1);
    const blocks = onChange.mock.calls[0]![0];
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("gallery");
  });

  it("reordena los bloques con las acciones subir/bajar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SiteBuilder
        availableBlocks={siteBuilderAvailableBlocks}
        initialBlocks={siteBuilderInitialBlocks}
        labels={siteBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Acciones de Portada principal" }));
    // El primer bloque no puede subir.
    expect(screen.getByRole("menuitem", { name: "Subir" })).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("menuitem", { name: "Bajar" }));

    const blocks = onChange.mock.calls.at(-1)![0];
    expect(blocks.map((block: { id: string }) => block.id)).toEqual(["text-1", "hero-1"]);
  });

  it("elimina un bloque del lienzo", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SiteBuilder
        availableBlocks={siteBuilderAvailableBlocks}
        initialBlocks={siteBuilderInitialBlocks}
        labels={siteBuilderLabels}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Acciones de Presentación" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    const canvas = within(screen.getByRole("region", { name: "Lienzo" }));
    expect(canvas.queryByText("Presentación")).toBeNull();
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it("edita el nombre del bloque seleccionado desde el panel lateral", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SiteBuilder
        availableBlocks={siteBuilderAvailableBlocks}
        initialBlocks={siteBuilderInitialBlocks}
        labels={siteBuilderLabels}
        onChange={onChange}
      />,
    );

    const canvas = within(screen.getByRole("region", { name: "Lienzo" }));
    // El texto va dentro del botón de la fila: el clic burbujea y selecciona.
    await user.click(canvas.getByText("Presentación"));

    const nameInput = screen.getByRole("textbox", { name: "Nombre del bloque" });
    expect(nameInput).toHaveProperty("value", "Presentación");

    await user.clear(nameInput);
    await user.type(nameInput, "Introducción");

    const blocks = onChange.mock.calls.at(-1)![0];
    expect(blocks[1].label).toBe("Introducción");
  });

  it("las acciones de la barra entregan la lista de bloques", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onPublish = vi.fn();

    render(
      <SiteBuilder
        availableBlocks={siteBuilderAvailableBlocks}
        initialBlocks={siteBuilderInitialBlocks}
        labels={siteBuilderLabels}
        onSave={onSave}
        onPublish={onPublish}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave.mock.calls[0]![0]).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(onPublish.mock.calls[0]![0]).toHaveLength(2);
  });

  it("añadir con contenido inicial no genera ids duplicados y las acciones solo afectan al bloque correcto", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SiteBuilder
        availableBlocks={siteBuilderAvailableBlocks}
        initialBlocks={siteBuilderInitialBlocks}
        labels={siteBuilderLabels}
        onChange={onChange}
      />,
    );

    // Añade otra "Portada" (el inicial ya usa el id "hero-1").
    await user.click(screen.getByText("Portada"));

    const added = onChange.mock.calls.at(-1)![0];
    expect(added).toHaveLength(3);
    expect(new Set(added.map((block: { id: string }) => block.id)).size).toBe(3);

    // Eliminar la nueva no toca la "Portada principal" inicial.
    await user.click(screen.getByRole("button", { name: "Acciones de Portada" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));

    const remaining = onChange.mock.calls.at(-1)![0];
    expect(remaining.map((block: { id: string }) => block.id)).toEqual(["hero-1", "text-1"]);
    const canvas = within(screen.getByRole("region", { name: "Lienzo" }));
    expect(canvas.getByText("Portada principal")).toBeDefined();
  });
});
