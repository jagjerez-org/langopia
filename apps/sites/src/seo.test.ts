import { describe, expect, it } from "vitest";

import type { BlockSnapshot, PublicSitePage, PublicSiteSummary } from "./public-site";
import {
  buildAlternateLinks,
  buildCanonicalUrl,
  buildRobotsTxt,
  buildSeoMetadata,
  buildSitemapXml,
  buildStructuredData,
  publicPathForPage,
} from "./seo";

const siteA = {
  site: {
    id: "site-a",
    schoolId: "school-a",
    schoolName: "Academia Atlántico",
    branding: { logoUrl: "https://cdn.test/atlantico-logo.png" },
    supportedLocales: ["es-ES", "en-GB", "de-DE"],
    defaultLocale: "es-ES",
    primaryLocale: "es-ES",
    theme: { primaryColor: "#0f766e" },
  },
  pages: [
    { id: "home-es", slug: "inicio", title: "Inicio", locale: "es-ES", isHome: true },
    { id: "home-en", slug: "home", title: "Home", locale: "en-GB", isHome: true },
    { id: "home-de", slug: "start", title: "Start", locale: "de-DE", isHome: true },
    { id: "courses-es", slug: "cursos", title: "Cursos", locale: "es-ES", isHome: false },
  ],
} satisfies PublicSiteSummary;

const siteB = {
  site: {
    id: "site-b",
    schoolId: "school-b",
    schoolName: "Nordwind Schule",
    branding: {},
    supportedLocales: ["de-DE"],
    defaultLocale: "de-DE",
    primaryLocale: "de-DE",
    theme: {},
  },
  pages: [{ id: "home-b", slug: "startseite", title: "Startseite", locale: "de-DE", isHome: true }],
} satisfies PublicSiteSummary;

const heroBlock = {
  id: "hero-1",
  type: "hero",
  props: {
    headline: "Aprende idiomas con profesorado que te conoce",
    subheadline: "Grupos reducidos en Vigo y online.",
    imageKey: "atlantico/site/hero.webp",
  },
} satisfies BlockSnapshot;

const coursesBlock = {
  id: "courses-1",
  type: "courses",
  props: { courseIds: ["course-es-b1", "course-en-b2"] },
} satisfies BlockSnapshot;

const page = {
  page: {
    id: "home-es",
    slug: "inicio",
    title: "Inicio",
    locale: "es-ES",
    metaDescription: "Cursos de idiomas con grupos reducidos.",
  },
  blocks: [heroBlock, coursesBlock],
} satisfies PublicSitePage;

describe("SEO helpers", () => {
  it("builds locale-aware public paths with the default locale at the root", () => {
    expect(publicPathForPage(siteA.pages[0]!, siteA)).toBe("/");
    expect(publicPathForPage(siteA.pages[1]!, siteA)).toBe("/en/");
    expect(publicPathForPage(siteA.pages[2]!, siteA)).toBe("/de/");
    expect(publicPathForPage(siteA.pages[3]!, siteA)).toBe("/cursos");
  });

  it("builds reciprocal hreflang links and x-default for the default language", () => {
    expect(buildAlternateLinks({ site: siteA, currentPage: siteA.pages[0]!, origin: "https://atlantico.test" })).toEqual([
      { hreflang: "es-ES", href: "https://atlantico.test/" },
      { hreflang: "en-GB", href: "https://atlantico.test/en/" },
      { hreflang: "de-DE", href: "https://atlantico.test/de/" },
      { hreflang: "x-default", href: "https://atlantico.test/" },
    ]);
  });

  it("uses the hero image for Open Graph and Twitter metadata", () => {
    expect(
      buildSeoMetadata({
        site: siteA,
        page,
        origin: "https://atlantico.test",
      }),
    ).toMatchObject({
      title: "Inicio · Academia Atlántico",
      description: "Cursos de idiomas con grupos reducidos.",
      canonicalUrl: "https://atlantico.test/",
      imageUrl: "https://atlantico.test/atlantico/site/hero.webp",
      locale: "es-ES",
    });
  });

  it("builds EducationalOrganization and Course JSON-LD from public data", () => {
    const graph = buildStructuredData({ site: siteA, page, origin: "https://atlantico.test" });

    expect(graph).toMatchObject({
      "@context": "https://schema.org",
      "@graph": expect.arrayContaining([
        expect.objectContaining({
          "@type": "EducationalOrganization",
          name: "Academia Atlántico",
          url: "https://atlantico.test/",
        }),
        expect.objectContaining({
          "@type": "Course",
          name: "Curso publicado course-es-b1",
          provider: expect.objectContaining({ name: "Academia Atlántico" }),
        }),
      ]),
    });
  });

  it("generates a sitemap only with the current school's pages", () => {
    const sitemapA = buildSitemapXml({ site: siteA, origin: "https://atlantico.test" });
    const sitemapB = buildSitemapXml({ site: siteB, origin: "https://nordwind.test" });

    expect(sitemapA).toContain("https://atlantico.test/");
    expect(sitemapA).toContain("https://atlantico.test/en/");
    expect(sitemapA).toContain("https://atlantico.test/cursos");
    expect(sitemapA).not.toContain("nordwind.test");
    expect(sitemapA).not.toContain("startseite");

    expect(sitemapB).toContain("https://nordwind.test/");
    expect(sitemapB).not.toContain("atlantico.test");
    expect(sitemapB).not.toContain("cursos");
  });

  it("points robots.txt to the host-specific sitemap", () => {
    expect(buildRobotsTxt("https://atlantico.test")).toBe(
      "User-agent: *\nAllow: /\nSitemap: https://atlantico.test/sitemap.xml\n",
    );
  });

  it("builds canonical URLs from the page and origin", () => {
    expect(buildCanonicalUrl({ site: siteA, page: siteA.pages[1]!, origin: "https://atlantico.test" })).toBe(
      "https://atlantico.test/en/",
    );
  });
});
