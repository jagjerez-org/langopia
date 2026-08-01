import { describe, expect, it } from "vitest";
import { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { Block } from "./block.vo.js";
import { Page } from "./page.entity.js";
import { Site } from "./site.aggregate.js";

const SCHOOL = SchoolId.of("11111111-1111-4111-8111-111111111111");

function textBlock(id = "text-1") {
  return Block.text({
    id,
    content: [{ kind: "paragraph", text: "Cursos para adultos y empresas." }],
  });
}

function page(params: { id?: string; slug?: string; blocks?: Block[] } = {}) {
  return Page.create({
    id: params.id ?? "page-1",
    title: "Inicio",
    slug: params.slug ?? "inicio",
    blocks: params.blocks ?? [textBlock()],
  });
}

describe("Page", () => {
  it("no permite más de un hero por página", () => {
    const hero = (id: string) =>
      Block.hero({
        id,
        headline: "Academia",
        subtitle: "Idiomas para avanzar",
        image: { url: "https://cdn.langopia.test/hero.jpg", alt: "Clase" },
        callToAction: { label: "Contactar", href: "/contacto" },
      });

    expect(() =>
      Page.create({
        id: "page-hero",
        title: "Inicio",
        slug: "inicio",
        blocks: [hero("hero-1"), hero("hero-2")],
      }),
    ).toThrow(/hero/);
  });

  it("solo puede publicarse con al menos un bloque", () => {
    const emptyPage = Page.create({ id: "empty", title: "Vacía", slug: "vacia", blocks: [] });

    expect(() => emptyPage.publish()).toThrow(/bloque/);
  });

  it("reordena bloques conservando los mismos identificadores", () => {
    const first = textBlock("text-1");
    const second = Block.faq({
      id: "faq-1",
      items: [{ question: "¿Hay online?", answer: "Sí." }],
    });
    const currentPage = page({ blocks: [first, second] });

    currentPage.reorderBlocks(["faq-1", "text-1"]);

    expect(currentPage.blocks.map((block) => block.id)).toEqual(["faq-1", "text-1"]);
  });
});

describe("Site", () => {
  it("añade páginas con slug único dentro del sitio", () => {
    const site = Site.create({ id: "site-1", schoolId: SCHOOL, hostname: "academia.test" });
    site.addPage(page({ id: "page-1", slug: "inicio" }));

    expect(() => site.addPage(page({ id: "page-2", slug: "inicio" }))).toThrow(/slug/);
  });

  it("publica solo si todas las páginas publicadas respetan sus invariantes", () => {
    const site = Site.create({ id: "site-1", schoolId: SCHOOL, hostname: "academia.test" });
    const home = page({ id: "home", slug: "inicio" });
    home.publish();
    site.addPage(home);

    site.publish();

    expect(site.published).toBe(true);
  });

  it("no publica un sitio sin páginas publicadas", () => {
    const site = Site.create({ id: "site-1", schoolId: SCHOOL, hostname: "academia.test" });
    site.addPage(page({ id: "draft", slug: "borrador" }));

    expect(() => site.publish()).toThrow(/página publicada/);
  });

  it("despublica un sitio publicado", () => {
    const site = Site.create({ id: "site-1", schoolId: SCHOOL, hostname: "academia.test" });
    const home = page();
    home.publish();
    site.addPage(home);
    site.publish();

    site.unpublish();

    expect(site.published).toBe(false);
  });
});
