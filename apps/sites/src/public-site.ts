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

export type BlockSnapshot = {
  id: string;
  type: "hero" | "courses" | "teachers" | "pricing" | "testimonials" | "faq" | "contact" | "text";
  props: Record<string, unknown>;
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

export function pageSlugForPath(pathname: string, site: PublicSiteSummary): string | null {
  const requestedPath = pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  const segments = requestedPath === "" ? [] : requestedPath.split("/");
  const locale = localeFromPrefix(segments[0], site);
  if (locale) {
    const localizedSlug = segments.slice(1).join("/");
    if (localizedSlug !== "") return localizedSlug;

    return site.pages.find((page) => page.isHome && page.locale === locale)?.slug ?? null;
  }

  if (requestedPath !== "") return requestedPath;

  return (
    site.pages.find((page) => page.isHome && page.locale === site.site.defaultLocale)?.slug ??
    site.pages.find((page) => page.isHome)?.slug ??
    null
  );
}

export function publicPageUrl(apiUrl: string, siteId: string, slug: string): string {
  const endpoint = new URL(`/api/v1/public/sites/${siteId}/pages/${encodeURIComponent(slug)}`, apiUrl);
  return endpoint.toString();
}

export async function fetchPublicSitePage(params: {
  apiUrl: string;
  site: PublicSiteSummary;
  pathname: string;
}): Promise<PublicSitePage | null> {
  const slug = pageSlugForPath(params.pathname, params.site);
  if (slug === null) return null;

  const response = await fetch(publicPageUrl(params.apiUrl, params.site.site.id, slug));
  if (!response.ok) return null;

  return (await response.json()) as PublicSitePage;
}

export function brandStyle(site: PublicSiteSummary): string {
  const primary = colorToken(site.site.theme.primaryColor) ?? colorToken(site.site.branding.primaryColor) ?? "#0f766e";
  const accent = colorToken(site.site.theme.accentColor) ?? colorToken(site.site.branding.accentColor) ?? "#f97316";
  const font =
    textToken(site.site.theme.fontPair) ??
    textToken(site.site.branding.fontPair) ??
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";

  return `--brand-primary:${primary};--brand-accent:${accent};--brand-font:${font};`;
}

function colorToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
}

function textToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function localeFromPrefix(prefix: string | undefined, site: PublicSiteSummary): string | null {
  if (!prefix) return null;
  const normalized = prefix.toLowerCase();
  return (
    site.site.supportedLocales.find(
      (locale) => locale.toLowerCase() === normalized || locale.split("-")[0]?.toLowerCase() === normalized,
    ) ?? null
  );
}
