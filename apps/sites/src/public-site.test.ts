import { afterEach, describe, expect, it, vi } from "vitest";

import { brandStyle, fetchPublicSitePage, pageSlugForPath, publicPageUrl } from "./public-site";
import type { PublicSiteSummary } from "./public-site";

const site = {
  site: {
    id: "site-a",
    schoolId: "school-a",
    schoolName: "Academia Atlántico",
    branding: { primaryColor: "#0f766e" },
    supportedLocales: ["es-ES"],
    defaultLocale: "es-ES",
    primaryLocale: "es-ES",
    theme: { accentColor: "#f97316" },
  },
  pages: [
    { id: "page-home", slug: "inicio", title: "Inicio", locale: "es-ES", isHome: true },
    { id: "page-courses", slug: "cursos", title: "Cursos", locale: "es-ES", isHome: false },
  ],
} satisfies PublicSiteSummary;

describe("public site page helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the configured home page slug for the root path", () => {
    expect(pageSlugForPath("/", site)).toBe("inicio");
    expect(pageSlugForPath("/cursos/", site)).toBe("cursos");
  });

  it("uses locale prefixes to resolve localized home and inner pages", () => {
    const multilingualSite = {
      ...site,
      site: {
        ...site.site,
        supportedLocales: ["es-ES", "en-GB", "de-DE"],
        defaultLocale: "es-ES",
      },
      pages: [
        ...site.pages,
        { id: "page-home-en", slug: "home", title: "Home", locale: "en-GB", isHome: true },
        { id: "page-courses-en", slug: "courses", title: "Courses", locale: "en-GB", isHome: false },
      ],
    } satisfies PublicSiteSummary;

    expect(pageSlugForPath("/en/", multilingualSite)).toBe("home");
    expect(pageSlugForPath("/en/courses/", multilingualSite)).toBe("courses");
  });

  it("returns null when the site has no published home page", () => {
    expect(pageSlugForPath("/", { ...site, pages: [] })).toBeNull();
  });

  it("fetches page content from the public API using the resolved site id and slug", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("http://api.test/api/v1/public/sites/site-a/pages/inicio");
      return Response.json({
        page: { id: "page-home", slug: "inicio", title: "Inicio", locale: "es-ES", metaDescription: null },
        blocks: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchPublicSitePage({
      apiUrl: "http://api.test",
      site,
      pathname: "/",
    });

    expect(page?.page.slug).toBe("inicio");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns null when the public API rejects the page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("No encontrado", { status: 404 })));

    await expect(fetchPublicSitePage({ apiUrl: "http://api.test", site, pathname: "/missing" })).resolves.toBeNull();
  });

  it("exposes validated brand tokens as CSS variables", () => {
    expect(brandStyle(site)).toContain("--brand-primary:#0f766e");
    expect(brandStyle(site)).toContain("--brand-accent:#f97316");
    expect(brandStyle(site)).toContain("--brand-font:");
  });

  it("builds encoded public page URLs", () => {
    expect(publicPageUrl("http://api.test", "site-a", "cursos intensivos")).toBe(
      "http://api.test/api/v1/public/sites/site-a/pages/cursos%20intensivos",
    );
  });
});
