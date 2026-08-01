import { InvalidSitePageError } from "../errors/sites.errors.js";
import { Block, SiteBlockType } from "./block.vo.js";

export class Page {
  private constructor(
    private readonly _id: string,
    private _title: string,
    private _slug: string,
    private _blocks: Block[],
    private _published: boolean,
  ) {
    this.assertAtMostOneHero();
  }

  static create(params: {
    id: string;
    title: string;
    slug: string;
    blocks?: readonly Block[];
    published?: boolean;
  }): Page {
    const page = new Page(
      requireText(params.id, "id de la página"),
      requireText(params.title, "título de la página"),
      normalizeSlug(params.slug),
      [...(params.blocks ?? [])],
      params.published ?? false,
    );
    if (page._published) page.assertPublishable();
    return page;
  }

  publish(): void {
    this.assertPublishable();
    this._published = true;
  }

  unpublish(): void {
    this._published = false;
  }

  replaceBlocks(blocks: readonly Block[]): void {
    const previous = this._blocks;
    this._blocks = [...blocks];
    try {
      this.assertAtMostOneHero();
      if (this._published) this.assertPublishable();
    } catch (error) {
      this._blocks = previous;
      throw error;
    }
  }

  reorderBlocks(blockIds: readonly string[]): void {
    if (blockIds.length !== this._blocks.length) {
      throw new InvalidSitePageError("La reordenación debe incluir todos los bloques de la página.");
    }
    const blocksById = new Map(this._blocks.map((block) => [block.id, block]));
    const reordered = blockIds.map((id) => blocksById.get(id));
    if (reordered.some((block) => block === undefined) || new Set(blockIds).size !== blockIds.length) {
      throw new InvalidSitePageError("La reordenación contiene bloques desconocidos o repetidos.");
    }
    this._blocks = reordered as Block[];
  }

  private assertPublishable(): void {
    if (this._blocks.length === 0) {
      throw new InvalidSitePageError("Una página publicada necesita al menos un bloque.", {
        pageId: this._id,
      });
    }
    this.assertAtMostOneHero();
  }

  private assertAtMostOneHero(): void {
    const heroCount = this._blocks.filter((block) => block.type === SiteBlockType.Hero).length;
    if (heroCount > 1) {
      throw new InvalidSitePageError("Una página solo puede tener un bloque hero.", {
        pageId: this._id,
        heroCount,
      });
    }
  }

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get slug(): string {
    return this._slug;
  }

  get blocks(): readonly Block[] {
    return this._blocks;
  }

  get published(): boolean {
    return this._published;
  }
}

function requireText(value: string, field: string): string {
  const text = value.trim();
  if (text.length === 0) throw new InvalidSitePageError(`El campo ${field} es obligatorio.`);
  return text;
}

function normalizeSlug(value: string): string {
  const slug = requireText(value, "slug").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new InvalidSitePageError("El slug de la página solo admite letras, números y guiones.");
  }
  return slug;
}
