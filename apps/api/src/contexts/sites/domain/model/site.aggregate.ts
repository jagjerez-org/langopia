import type { SchoolId } from "../../../shared/domain/primitives/school-id.js";
import { InvalidSiteError } from "../errors/sites.errors.js";
import { Page } from "./page.entity.js";

export class Site {
  private constructor(
    private readonly _id: string,
    private readonly _schoolId: SchoolId,
    private _hostname: string,
    private _pages: Page[],
    private _published: boolean,
  ) {
    this.assertUniqueSlugs();
  }

  static create(params: {
    id: string;
    schoolId: SchoolId;
    hostname: string;
    pages?: readonly Page[];
    published?: boolean;
  }): Site {
    const site = new Site(
      requireText(params.id, "id del sitio"),
      params.schoolId,
      normalizeHostname(params.hostname),
      [...(params.pages ?? [])],
      params.published ?? false,
    );
    if (site._published) site.assertPublishable();
    return site;
  }

  addPage(page: Page): void {
    if (this._pages.some((current) => current.slug === page.slug)) {
      throw new InvalidSiteError("El slug de la página debe ser único dentro del sitio.", {
        slug: page.slug,
      });
    }
    this._pages = [...this._pages, page];
  }

  reorderBlocks(pageId: string, blockIds: readonly string[]): void {
    const page = this._pages.find((candidate) => candidate.id === pageId);
    if (!page) {
      throw new InvalidSiteError(`No existe la página ${pageId} en este sitio.`, { pageId });
    }
    page.reorderBlocks(blockIds);
  }

  publish(): void {
    this.assertPublishable();
    this._published = true;
  }

  unpublish(): void {
    this._published = false;
  }

  private assertPublishable(): void {
    this.assertUniqueSlugs();
    if (!this._pages.some((page) => page.published)) {
      throw new InvalidSiteError("Un sitio publicado necesita al menos una página publicada.");
    }
  }

  private assertUniqueSlugs(): void {
    const slugs = new Set<string>();
    for (const page of this._pages) {
      if (slugs.has(page.slug)) {
        throw new InvalidSiteError("El slug de la página debe ser único dentro del sitio.", {
          slug: page.slug,
        });
      }
      slugs.add(page.slug);
    }
  }

  get id(): string {
    return this._id;
  }

  get schoolId(): SchoolId {
    return this._schoolId;
  }

  get hostname(): string {
    return this._hostname;
  }

  get pages(): readonly Page[] {
    return this._pages;
  }

  get published(): boolean {
    return this._published;
  }
}

function requireText(value: string, field: string): string {
  const text = value.trim();
  if (text.length === 0) throw new InvalidSiteError(`El campo ${field} es obligatorio.`);
  return text;
}

function normalizeHostname(value: string): string {
  const hostname = requireText(value, "hostname").toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(hostname)) {
    throw new InvalidSiteError("El hostname del sitio no es válido.", { hostname });
  }
  return hostname;
}
