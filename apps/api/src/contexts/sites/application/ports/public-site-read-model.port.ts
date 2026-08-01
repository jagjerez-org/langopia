import type { BlockSnapshot } from "../../domain/model/block.vo.js";

export const PUBLIC_SITE_READ_MODEL = Symbol("PublicSiteReadModel");

export type PublicSiteSummary = {
  site: {
    id: string;
    schoolId: string;
    schoolName: string;
    branding: Record<string, unknown>;
    supportedLocales: readonly string[];
    defaultLocale: string;
    primaryLocale: string;
    theme: Record<string, unknown>;
  };
  pages: readonly PublicSitePageSummary[];
};

export type PublicSitePageSummary = {
  id: string;
  slug: string;
  title: string;
  locale: string;
  isHome: boolean;
};

export type PublicSitePage = {
  page: {
    id: string;
    slug: string;
    title: string;
    locale: string;
    metaDescription: string | null;
  };
  blocks: readonly BlockSnapshot[];
};

export interface PublicSiteReadModel {
  resolveSiteByHost(host: string): Promise<PublicSiteSummary | null>;
  getPublishedPage(params: { siteId: string; slug: string }): Promise<PublicSitePage | null>;
}
