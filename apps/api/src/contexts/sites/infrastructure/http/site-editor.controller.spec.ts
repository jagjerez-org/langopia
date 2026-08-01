import { describe, expect, it, vi } from "vitest";
import { ROLES_KEY } from "../../../shared/infrastructure/http/roles.decorator.js";
import { PublishSiteCommand, UnpublishSiteCommand } from "../../application/commands/publish-site/publish-site.handler.js";
import { SaveSitePageBlocksCommand } from "../../application/commands/save-page-blocks/save-page-blocks.handler.js";
import { GetEditableSiteQuery } from "../../application/queries/get-editable-site/get-editable-site.handler.js";
import { SiteEditorController } from "./site-editor.controller.js";

describe("SiteEditorController", () => {
  it("restringe el editor a owner/admin", () => {
    expect(Reflect.getMetadata(ROLES_KEY, SiteEditorController)).toEqual(["owner", "admin"]);
  });

  it("obtiene el sitio editable", async () => {
    const execute = vi.fn(async () => ({ site: { id: "site-1" } }));
    const controller = new SiteEditorController({ execute } as never, { execute } as never);

    await controller.get();

    expect(execute).toHaveBeenCalledWith(new GetEditableSiteQuery());
  });

  it("guarda bloques de una página usando el catálogo cerrado", async () => {
    const execute = vi.fn(async () => ({ id: "page-1" }));
    const controller = new SiteEditorController({ execute } as never, { execute } as never);
    const blocks = [
      {
        id: "block-1",
        type: "hero",
        props: {
          headline: "Aprende inglés",
          subtitle: "Grupos reducidos",
          image: { url: "/hero.webp", alt: "Clase" },
          callToAction: { label: "Contactar", href: "/contacto" },
        },
      },
    ];

    await controller.saveBlocks("11111111-1111-4111-8111-111111111111", { blocks } as never);

    expect(execute).toHaveBeenCalledWith(
      new SaveSitePageBlocksCommand({
        pageId: "11111111-1111-4111-8111-111111111111",
        blocks: blocks as never,
      }),
    );
  });

  it("publica y despublica de forma explícita", async () => {
    const execute = vi.fn(async () => ({ id: "site-1" }));
    const controller = new SiteEditorController({ execute } as never, { execute } as never);

    await controller.publish();
    await controller.unpublish();

    expect(execute).toHaveBeenNthCalledWith(1, new PublishSiteCommand());
    expect(execute).toHaveBeenNthCalledWith(2, new UnpublishSiteCommand());
  });
});
