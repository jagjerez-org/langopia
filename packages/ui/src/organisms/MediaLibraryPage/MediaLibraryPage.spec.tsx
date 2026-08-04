import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mediaFileActions,
  mediaFiles,
  mediaLibraryPageLabels,
} from "../../fixtures/content.js";
import { MediaLibraryPage } from "./MediaLibraryPage.js";

const baseProps = {
  files: mediaFiles,
  actions: mediaFileActions,
  labels: mediaLibraryPageLabels,
};

/** Tarjeta (ítem de la rejilla) que contiene el nombre de archivo dado. */
function cardOf(fileName: string): HTMLElement {
  const item = screen.getByText(fileName).closest("li");
  if (item === null) {
    throw new Error(`No se encontró la tarjeta de ${fileName}`);
  }
  return item;
}

describe("MediaLibraryPage", () => {
  it("muestra la rejilla de archivos con su tipo", () => {
    render(<MediaLibraryPage {...baseProps} onFileAction={() => {}} onUpload={() => {}} />);

    expect(screen.getByRole("heading", { name: "Biblioteca de medios" })).toBeDefined();
    expect(screen.getByText("portada-curso-b1.png")).toBeDefined();
    expect(screen.getByText("guia-gramatica-b1.pdf")).toBeDefined();
    // Dos chips de tipo "Documento" dentro de la rejilla (el filtro también lo lista).
    const library = screen.getByRole("region", { name: "Archivos de la biblioteca" });
    expect(within(library).getAllByText("Documento").length).toBe(2);
  });

  it("el filtro por tipo muestra solo los archivos de ese tipo", async () => {
    const user = userEvent.setup();
    render(<MediaLibraryPage {...baseProps} onFileAction={() => {}} onUpload={() => {}} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Tipo" }), "video");

    expect(screen.getByText("leccion-fonetica.mp4")).toBeDefined();
    expect(screen.queryByText("portada-curso-b1.png")).toBeNull();
  });

  it("el buscador filtra los archivos por nombre", async () => {
    const user = userEvent.setup();
    render(<MediaLibraryPage {...baseProps} onFileAction={() => {}} onUpload={() => {}} />);

    await user.type(screen.getByRole("searchbox", { name: "Buscar archivo" }), "calendario");

    expect(screen.getByText("calendario-2026.pdf")).toBeDefined();
    expect(screen.queryByText("guia-gramatica-b1.pdf")).toBeNull();
  });

  it("la acción de un archivo notifica el id del archivo y el de la acción", async () => {
    const user = userEvent.setup();
    const onFileAction = vi.fn();
    render(
      <MediaLibraryPage {...baseProps} onFileAction={onFileAction} onUpload={() => {}} />,
    );

    await user.click(
      within(cardOf("guia-gramatica-b1.pdf")).getByRole("button", { name: "Eliminar" }),
    );

    expect(onFileAction).toHaveBeenCalledWith("med-05", "delete");
  });

  it("el botón de subir notifica onUpload", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<MediaLibraryPage {...baseProps} onFileAction={() => {}} onUpload={onUpload} />);

    await user.click(screen.getByRole("button", { name: "Subir archivo" }));

    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it("muestra el estado vacío cuando no hay resultados", async () => {
    const user = userEvent.setup();
    render(<MediaLibraryPage {...baseProps} onFileAction={() => {}} onUpload={() => {}} />);

    await user.type(screen.getByRole("searchbox", { name: "Buscar archivo" }), "inexistente");

    expect(screen.getByText("No hay archivos con estos criterios.")).toBeDefined();
  });
});
