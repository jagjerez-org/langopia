import { describe, expect, it, vi } from "vitest";
import { InvalidSiteBlockError } from "../../../domain/errors/sites.errors.js";
import type { SiteEditorRepository } from "../../ports/site-editor.repository.port.js";
import { SaveSitePageBlocksCommand, SaveSitePageBlocksHandler } from "./save-page-blocks.handler.js";

describe("SaveSitePageBlocksHandler", () => {
  it("rechaza bloques fuera del catálogo antes de guardar", async () => {
    const repository = { replacePageBlocks: vi.fn() } as unknown as SiteEditorRepository;
    const handler = new SaveSitePageBlocksHandler(repository, immediateUow());

    await expect(
      handler.execute(
        new SaveSitePageBlocksCommand({
          pageId: "page-1",
          blocks: [{ id: "block-1", type: "mapa", props: {} } as never],
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidSiteBlockError);
    expect(repository.replacePageBlocks).not.toHaveBeenCalled();
  });

  it("guarda bloques válidos dentro de la unidad de trabajo", async () => {
    const page = {
      id: "page-1",
      slug: "",
      title: "Inicio",
      locale: "es-ES",
      isHome: true,
      published: false,
      blocks: [],
    };
    const repository = { replacePageBlocks: vi.fn(async () => page) } as unknown as SiteEditorRepository;
    const uow = { execute: vi.fn(async (work: () => Promise<unknown>) => work()) };
    const handler = new SaveSitePageBlocksHandler(repository, uow as never);

    await handler.execute(
      new SaveSitePageBlocksCommand({
        pageId: "page-1",
        blocks: [
          {
            id: "block-1",
            type: "contact",
            props: { title: "Hablemos", submitLabel: "Enviar", leadSource: "school_site" },
          },
        ],
      }),
    );

    expect(uow.execute).toHaveBeenCalled();
    expect(repository.replacePageBlocks).toHaveBeenCalledWith("page-1", [
      {
        id: "block-1",
        type: "contact",
        props: { title: "Hablemos", submitLabel: "Enviar", leadSource: "school_site" },
      },
    ]);
  });
});

function immediateUow() {
  return { execute: async <T>(work: () => Promise<T>) => work() } as never;
}
