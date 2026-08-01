import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import * as schema from "@langopia/db/schema";
import type { BlockSnapshot } from "../../domain/model/block.vo.js";
import type {
  EditableSite,
  EditableSitePage,
  EditableTeacherOption,
  SiteEditorRepository,
} from "../../application/ports/site-editor.repository.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";

type SiteRow = {
  id: string;
  status: "draft" | "published" | "unpublished";
  primary_locale: string;
  theme: Record<string, unknown>;
};

type PageRow = {
  id: string;
  slug: string;
  title: string;
  locale: string;
  is_home: boolean;
  published_at: Date | string | null;
  position: number;
};

type BlockRow = {
  id: string;
  page_id: string;
  type: string;
  content: Record<string, unknown>;
  position: number;
};

@Injectable()
export class DrizzleSiteEditorRepository implements SiteEditorRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async getEditableSite(previewBaseUrl: string): Promise<EditableSite | null> {
    const [site] = await this.drizzle.db.execute<SiteRow>(sql`
      SELECT id, status::text, primary_locale, theme
      FROM sites
      ORDER BY created_at
      LIMIT 1
    `);
    if (!site) return null;

    const pages = await this.loadPages(site.id);
    const blocks = await this.loadBlocks(pages.map((page) => page.id));
    const locales = Array.from(new Set(pages.map((page) => page.locale)));
    const teacherOptions = await this.loadTeacherOptions();

    return {
      site: {
        id: site.id,
        status: site.status,
        primaryLocale: site.primary_locale,
        theme: site.theme,
        previewUrl: `${previewBaseUrl}/?draft=${site.id}`,
      },
      locales,
      pages: pages.map((page) => mapPage(page, blocks.get(page.id) ?? [])),
      teacherOptions,
    };
  }

  async replacePageBlocks(pageId: string, blocks: readonly BlockSnapshot[]): Promise<EditableSitePage | null> {
    const [page] = await this.drizzle.db.execute<PageRow>(sql`
      SELECT id, slug, title, locale, is_home, published_at, position
      FROM site_pages
      WHERE id = ${pageId}::uuid
      LIMIT 1
    `);
    if (!page) return null;

    await this.drizzle.db.delete(schema.siteBlocks).where(eq(schema.siteBlocks.pageId, pageId));
    if (blocks.length > 0) {
      await this.drizzle.db.insert(schema.siteBlocks).values(
        blocks.map((block, position) => ({
          id: block.id,
          schoolId: sql`current_setting('app.school_id', true)::uuid` as never,
          pageId,
          type: block.type,
          position,
          content: block.props as Record<string, unknown>,
          isVisible: true,
        })),
      );
    }
    return mapPage(page, blocks.map((block, position) => ({ ...block, position })));
  }

  async publishSite(): Promise<EditableSite["site"] | null> {
    const [row] = await this.drizzle.db.execute<SiteRow>(sql`
      UPDATE sites
      SET status = 'published', published_at = now()
      WHERE EXISTS (
        SELECT 1 FROM site_pages
        WHERE site_pages.site_id = sites.id
          AND site_pages.published_at IS NOT NULL
      )
      RETURNING id, status::text, primary_locale, theme
    `);
    return row ? mapSite(row, "") : null;
  }

  async unpublishSite(): Promise<EditableSite["site"] | null> {
    const [row] = await this.drizzle.db.execute<SiteRow>(sql`
      UPDATE sites
      SET status = 'unpublished', published_at = NULL
      RETURNING id, status::text, primary_locale, theme
    `);
    return row ? mapSite(row, "") : null;
  }

  private async loadPages(siteId: string): Promise<PageRow[]> {
    return this.drizzle.db.execute<PageRow>(sql`
      SELECT id, slug, title, locale, is_home, published_at, position
      FROM site_pages
      WHERE site_id = ${siteId}::uuid
      ORDER BY locale, position, slug
    `);
  }

  private async loadBlocks(pageIds: readonly string[]): Promise<Map<string, Array<BlockSnapshot & { position: number }>>> {
    const blocksByPage = new Map<string, Array<BlockSnapshot & { position: number }>>();
    if (pageIds.length === 0) return blocksByPage;
    const rows = await this.drizzle.db.execute<BlockRow>(sql`
      SELECT id, page_id, type, content, position
      FROM site_blocks
      WHERE page_id IN (${sql.join(pageIds.map((id) => sql`${id}::uuid`), sql`, `)})
        AND is_visible = true
      ORDER BY page_id, position
    `);
    for (const row of rows) {
      const list = blocksByPage.get(row.page_id) ?? [];
      list.push({ id: row.id, type: row.type, props: normalizeBlockProps(row.type, row.content), position: row.position } as BlockSnapshot & { position: number });
      blocksByPage.set(row.page_id, list);
    }
    return blocksByPage;
  }

  private async loadTeacherOptions(): Promise<EditableTeacherOption[]> {
    const rows = await this.drizzle.db.execute<{
      teacher_id: string;
      display_name: string;
      image_url: string | null;
      image_rights: boolean;
    }>(sql`
      SELECT
        tp.id AS teacher_id,
        u.name AS display_name,
        NULL::text AS image_url,
        COALESCE(c.status = 'granted', false) AS image_rights
      FROM teacher_profiles tp
      JOIN memberships m ON m.id = tp.membership_id
      JOIN users u ON u.id = m.user_id
      LEFT JOIN consents c ON c.subject_membership_id = m.id AND c.kind = 'image_rights'
      WHERE tp.status = 'active'
      ORDER BY u.name
    `);
    return rows.map((row) => ({
      teacherId: row.teacher_id,
      displayName: row.display_name,
      imageUrl: row.image_url,
      imageRights: row.image_rights,
    }));
  }
}

function mapPage(page: PageRow, blocks: readonly (BlockSnapshot & { position?: number })[]): EditableSitePage {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    locale: page.locale,
    isHome: page.is_home,
    published: page.published_at !== null,
    blocks: [...blocks]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((block) => ({ id: block.id, type: block.type, props: block.props }) as BlockSnapshot),
  };
}

function mapSite(site: SiteRow, previewBaseUrl: string): EditableSite["site"] {
  return {
    id: site.id,
    status: site.status,
    primaryLocale: site.primary_locale,
    theme: site.theme,
    previewUrl: previewBaseUrl ? `${previewBaseUrl}/?draft=${site.id}` : `/?draft=${site.id}`,
  };
}

function normalizeBlockProps(type: string, content: Record<string, unknown>): Record<string, unknown> {
  if (type === "hero") {
    const cta = objectValue(content.callToAction) ?? objectValue(content.cta) ?? {};
    return {
      headline: textValue(content.headline, "Titular"),
      subtitle: textValue(content.subtitle ?? content.subheadline, ""),
      image: objectValue(content.image) ?? {
        url: textValue(content.imageUrl ?? content.imageKey, "/"),
        alt: textValue(content.imageAlt, "Imagen del sitio"),
      },
      callToAction: {
        label: textValue(cta.label, "Contactar"),
        href: textValue(cta.href, "/contacto"),
      },
    };
  }
  if (type === "courses") {
    const courseIds = arrayValue(content.courseIds);
    return { source: courseIds.length > 0 ? { kind: "selected", courseIds } : { kind: "all_active" } };
  }
  if (type === "teachers") {
    return { teachers: arrayValue(content.teachers) };
  }
  if (type === "pricing") {
    return { planIds: arrayValue(content.planIds).length > 0 ? arrayValue(content.planIds) : ["growth"] };
  }
  if (type === "testimonials") {
    return { testimonials: arrayValue(content.testimonials) };
  }
  if (type === "faq") {
    const items = arrayValue(content.items).map((item) => {
      const raw = objectValue(item) ?? {};
      return { question: textValue(raw.question ?? raw.q, ""), answer: textValue(raw.answer ?? raw.a, "") };
    });
    return { items: items.length > 0 ? items : [{ question: "Pregunta", answer: "Respuesta" }] };
  }
  if (type === "contact") {
    return {
      title: textValue(content.title, "Hablemos"),
      submitLabel: textValue(content.submitLabel, "Enviar"),
      leadSource: "school_site",
    };
  }
  if (type === "text") {
    const rich = arrayValue(content.content);
    if (rich.length > 0) return { content: rich };
    return { content: [{ kind: "paragraph", text: textValue(content.html, "") }] };
  }
  return content;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
