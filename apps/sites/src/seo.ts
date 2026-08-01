import { heroContent, selectedIds } from "./block-content";
import type { BlockSnapshot, PublicSitePage, PublicSitePageSummary, PublicSiteSummary } from "./public-site";

export type AlternateLink = {
  hreflang: string;
  href: string;
};

export type SeoMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string | null;
  locale: string;
  alternateLinks: AlternateLink[];
  structuredData: Record<string, unknown>;
};

export function buildSeoMetadata(params: {
  site: PublicSiteSummary;
  page: PublicSitePage;
  origin: string;
}): SeoMetadata {
  const summary =
    params.site.pages.find((sitePage) => sitePage.id === params.page.page.id) ?? pageSummaryFromPublicPage(params.page);
  const title = `${params.page.page.title} · ${params.site.site.schoolName}`;
  const description = params.page.page.metaDescription ?? `${params.site.site.schoolName} · academia de idiomas`;
  const canonicalUrl = buildCanonicalUrl({ site: params.site, page: summary, origin: params.origin });

  return {
    title,
    description,
    canonicalUrl,
    imageUrl: heroImageUrl(params.page.blocks, params.origin),
    locale: params.page.page.locale,
    alternateLinks: buildAlternateLinks({ site: params.site, currentPage: summary, origin: params.origin }),
    structuredData: buildStructuredData(params),
  };
}

export function buildCanonicalUrl(params: {
  site: PublicSiteSummary;
  page: PublicSitePageSummary;
  origin: string;
}): string {
  return absoluteUrl(publicPathForPage(params.page, params.site), params.origin);
}

export function buildAlternateLinks(params: {
  site: PublicSiteSummary;
  currentPage: PublicSitePageSummary;
  origin: string;
}): AlternateLink[] {
  const relatedPages = params.site.pages.filter((page) => pagesBelongToSameLocalizedSet(page, params.currentPage));
  const localeLinks = relatedPages.map((page) => ({
    hreflang: page.locale,
    href: buildCanonicalUrl({ site: params.site, page, origin: params.origin }),
  }));
  const defaultPage =
    relatedPages.find((page) => page.locale === params.site.site.defaultLocale) ??
    relatedPages.find((page) => page.locale === params.site.site.primaryLocale) ??
    relatedPages[0];

  if (!defaultPage) return localeLinks;

  return [
    ...localeLinks,
    {
      hreflang: "x-default",
      href: buildCanonicalUrl({ site: params.site, page: defaultPage, origin: params.origin }),
    },
  ];
}

export function publicPathForPage(page: PublicSitePageSummary, site: PublicSiteSummary): string {
  const language = languagePrefix(page.locale);
  const isDefaultLocale = page.locale === site.site.defaultLocale;

  if (page.isHome) {
    return isDefaultLocale ? "/" : `/${language}/`;
  }

  const slug = page.slug.replace(/^\/+|\/+$/g, "");
  return isDefaultLocale ? `/${slug}` : `/${language}/${slug}`;
}

export function buildStructuredData(params: {
  site: PublicSiteSummary;
  page: PublicSitePage;
  origin: string;
}): Record<string, unknown> {
  const organizationId = `${params.origin.replace(/\/+$/g, "")}/#organization`;
  const organization = {
    "@type": "EducationalOrganization",
    "@id": organizationId,
    name: params.site.site.schoolName,
    url: buildCanonicalUrl({
      site: params.site,
      page: homePageForDefaultLocale(params.site) ?? params.site.pages[0] ?? pageSummaryFromPublicPage(params.page),
      origin: params.origin,
    }),
    logo: textToken(params.site.site.branding.logoUrl),
  };
  const courses = courseStructuredData({
    blocks: params.page.blocks,
    organizationId,
    providerName: params.site.site.schoolName,
  });

  return {
    "@context": "https://schema.org",
    "@graph": [organization, ...courses],
  };
}

export function buildSitemapXml(params: { site: PublicSiteSummary; origin: string }): string {
  const urls = params.site.pages.map((page) => {
    const location = escapeXml(buildCanonicalUrl({ site: params.site, page, origin: params.origin }));
    const alternates = buildAlternateLinks({ site: params.site, currentPage: page, origin: params.origin })
      .map(
        (alternate) =>
          `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(
            alternate.href,
          )}" />`,
      )
      .join("");

    return `<url><loc>${location}</loc>${alternates}</url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join(
    "",
  )}</urlset>\n`;
}

export function buildRobotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl("/sitemap.xml", origin)}\n`;
}

export function originFromRequest(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto && forwardedProto.length > 0 ? forwardedProto : new URL(request.url).protocol.replace(":", "");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  return `${proto}://${host}`;
}

function pageSummaryFromPublicPage(page: PublicSitePage): PublicSitePageSummary {
  return {
    id: page.page.id,
    slug: page.page.slug,
    title: page.page.title,
    locale: page.page.locale,
    isHome: page.page.slug === "" || page.page.slug === "inicio" || page.page.slug === "home",
  };
}

function pagesBelongToSameLocalizedSet(left: PublicSitePageSummary, right: PublicSitePageSummary): boolean {
  if (left.isHome && right.isHome) return true;
  return !left.isHome && !right.isHome && left.slug === right.slug;
}

function homePageForDefaultLocale(site: PublicSiteSummary): PublicSitePageSummary | null {
  return (
    site.pages.find((page) => page.isHome && page.locale === site.site.defaultLocale) ??
    site.pages.find((page) => page.isHome) ??
    null
  );
}

function heroImageUrl(blocks: readonly BlockSnapshot[], origin: string): string | null {
  const heroBlock = blocks.find((block) => block.type === "hero");
  if (!heroBlock) return null;

  const imageUrl = heroContent(heroBlock.props).imageUrl;
  return imageUrl ? absoluteUrl(imageUrl, origin) : null;
}

function courseStructuredData(params: {
  blocks: readonly BlockSnapshot[];
  organizationId: string;
  providerName: string;
}): Array<Record<string, unknown>> {
  return params.blocks
    .filter((block) => block.type === "courses")
    .flatMap((block) => selectedIds(block.props, "courseIds"))
    .map((courseId) => ({
      "@type": "Course",
      name: `Curso publicado ${courseId}`,
      courseCode: courseId,
      provider: {
        "@type": "EducationalOrganization",
        "@id": params.organizationId,
        name: params.providerName,
      },
    }));
}

function absoluteUrl(pathOrUrl: string, origin: string): string {
  return new URL(pathOrUrl, `${origin.replace(/\/+$/g, "")}/`).toString();
}

function languagePrefix(locale: string): string {
  return locale.split("-")[0]?.toLowerCase() ?? locale.toLowerCase();
}

function textToken(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
