import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ClsService } from "nestjs-cls";
import type { BlockSnapshot } from "../../domain/model/block.vo.js";
import {
  PUBLIC_SITE_READ_MODEL,
  type PublicSitePage,
  type PublicSiteReadModel,
  type PublicSiteSummary,
} from "../../application/ports/public-site-read-model.port.js";
import { UNIT_OF_WORK, type UnitOfWork } from "../../../shared/domain/ports/unit-of-work.port.js";
import { DrizzleService } from "../../../shared/infrastructure/persistence/drizzle.service.js";
import { CLS_SCHOOL_ID } from "../../../shared/infrastructure/tenant/cls-tenant-context.js";

type ResolveRow = {
  site_id: string;
  school_id: string;
  school_name: string;
  branding: Record<string, unknown>;
  supported_locales: string[];
  default_locale: string;
  primary_locale: string;
  theme: Record<string, unknown>;
};

type PageRow = {
  id: string;
  slug: string;
  title: string;
  locale: string;
  is_home: boolean;
  meta_description: string | null;
};

type BlockRow = {
  id: string;
  type: string;
  content: Record<string, unknown>;
};

@Injectable()
export class DrizzlePublicSiteReadModel implements PublicSiteReadModel {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly cls: ClsService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async resolveSiteByHost(host: string): Promise<PublicSiteSummary | null> {
    const schoolId = await this.schoolIdForHost(host);
    if (!schoolId) return null;

    return this.withSchool(schoolId, () =>
      this.uow.read(async () => {
        const [site] = await this.drizzle.db.execute<ResolveRow>(sql`
          SELECT
            s.id AS site_id,
            sc.id AS school_id,
            sc.name AS school_name,
            sc.branding,
            sc.supported_locales,
            sc.default_locale,
            s.primary_locale,
            s.theme
          FROM school_domains d
          JOIN sites s ON s.school_id = d.school_id
          JOIN schools sc ON sc.id = d.school_id
          WHERE lower(d.hostname) = ${host}
            AND d.verified_at IS NOT NULL
            AND s.status = 'published'
          LIMIT 1
        `);
        if (!site) return null;

        const pages = await this.drizzle.db.execute<PageRow>(sql`
          SELECT id, slug, title, locale, is_home, meta_description
          FROM site_pages
          WHERE site_id = ${site.site_id}::uuid
            AND published_at IS NOT NULL
          ORDER BY locale, position, slug
        `);

        return {
          site: {
            id: site.site_id,
            schoolId: site.school_id,
            schoolName: site.school_name,
            branding: site.branding,
            supportedLocales: site.supported_locales,
            defaultLocale: site.default_locale,
            primaryLocale: site.primary_locale,
            theme: site.theme,
          },
          pages: pages.map((page) => ({
            id: page.id,
            slug: page.slug,
            title: page.title,
            locale: page.locale,
            isHome: page.is_home,
          })),
        };
      }),
    );
  }

  async getPublishedPage(params: { siteId: string; slug: string }): Promise<PublicSitePage | null> {
    const schoolId = await this.schoolIdForSite(params.siteId);
    if (!schoolId) return null;

    return this.withSchool(schoolId, () =>
      this.uow.read(async () => {
        const [page] = await this.drizzle.db.execute<PageRow>(sql`
          SELECT p.id, p.slug, p.title, p.locale, p.is_home, p.meta_description
          FROM site_pages p
          JOIN sites s ON s.id = p.site_id
          WHERE p.site_id = ${params.siteId}::uuid
            AND p.slug = ${params.slug}
            AND p.published_at IS NOT NULL
            AND s.status = 'published'
          LIMIT 1
        `);
        if (!page) return null;

        const blocks = await this.drizzle.db.execute<BlockRow>(sql`
          SELECT id, type, content
          FROM site_blocks
          WHERE page_id = ${page.id}::uuid
            AND is_visible = true
          ORDER BY position
        `);

        return {
          page: {
            id: page.id,
            slug: page.slug,
            title: page.title,
            locale: page.locale,
            metaDescription: page.meta_description,
          },
          blocks: blocks.map((block) => ({
            id: block.id,
            type: block.type,
            props: block.content,
          })) as BlockSnapshot[],
        };
      }),
    );
  }

  private async schoolIdForHost(host: string): Promise<string | null> {
    const [row] = await this.drizzle.connection.execute<{ school_id: string | null }>(sql`
      SELECT public.school_id_for_verified_site_host(${host}) AS school_id
    `);
    return row?.school_id ?? null;
  }

  private async schoolIdForSite(siteId: string): Promise<string | null> {
    const [row] = await this.drizzle.connection.execute<{ school_id: string | null }>(sql`
      SELECT public.school_id_for_published_site(${siteId}::uuid) AS school_id
    `);
    return row?.school_id ?? null;
  }

  private async withSchool<T>(schoolId: string, work: () => Promise<T>): Promise<T> {
    return this.cls.runWith({ ...this.cls.get(), [CLS_SCHOOL_ID]: schoolId }, work);
  }
}

export const publicSiteReadModelProvider = {
  provide: PUBLIC_SITE_READ_MODEL,
  useClass: DrizzlePublicSiteReadModel,
};
