import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../shared/domain/errors/domain-error.js";
import {
  GetPublicSiteByHostHandler,
  GetPublicSiteByHostQuery,
  GetPublicSitePageHandler,
  GetPublicSitePageQuery,
} from "./get-public-site-by-host.handler.js";
import {
  PUBLIC_SITE_READ_MODEL,
  type PublicSiteSummary,
  type PublicSiteReadModel,
} from "../../ports/public-site-read-model.port.js";

const siteSummary: PublicSiteSummary = {
  site: {
    id: "site-1",
    schoolId: "school-1",
    schoolName: "Academia",
    branding: {},
    supportedLocales: ["es-ES"],
    defaultLocale: "es-ES",
    primaryLocale: "es-ES",
    theme: {},
  },
  pages: [],
};

describe("GetPublicSiteByHostHandler", () => {
  it("lanza not_found cuando el hostname no pertenece a un dominio verificado", async () => {
    const readModel: PublicSiteReadModel = {
      resolveSiteByHost: vi.fn(async () => null),
      getPublishedPage: vi.fn(),
    };
    const handler = new GetPublicSiteByHostHandler(readModel);

    await expect(
      handler.execute(new GetPublicSiteByHostQuery({ host: "unknown.example.test" })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("normaliza host con puerto antes de consultar", async () => {
    const readModel: PublicSiteReadModel = {
      resolveSiteByHost: vi.fn(async () => siteSummary),
      getPublishedPage: vi.fn(),
    };
    const handler = new GetPublicSiteByHostHandler(readModel);

    await handler.execute(new GetPublicSiteByHostQuery({ host: "School.EXAMPLE.test:4321" }));

    expect(readModel.resolveSiteByHost).toHaveBeenCalledWith("school.example.test");
  });
});

describe("GetPublicSitePageHandler", () => {
  it("filtra profesorado sin derechos de imagen y reseñas no públicas", async () => {
    const readModel: PublicSiteReadModel = {
      resolveSiteByHost: vi.fn(),
      getPublishedPage: vi.fn(async () => ({
        page: { id: "page-1", slug: "", title: "Inicio", locale: "es-ES", metaDescription: null },
        blocks: [
          {
            id: "teachers",
            type: "teachers",
            props: {
              teachers: [
                {
                  teacherId: "teacher-visible",
                  displayName: "Visible",
                  imageUrl: "https://cdn.example.test/visible.jpg",
                  imageRights: true,
                },
                {
                  teacherId: "teacher-hidden",
                  displayName: "Oculto",
                  imageUrl: "https://cdn.example.test/hidden.jpg",
                  imageRights: false,
                },
              ],
            },
          } as const,
          {
            id: "testimonials",
            type: "testimonials",
            props: {
              testimonials: [
                { testimonialId: "public", authorName: "Ana", quote: "Excelente", public: true },
                { testimonialId: "private", authorName: "Luis", quote: "Privada", public: false },
              ],
            },
          } as const,
        ],
      })),
    };
    const handler = new GetPublicSitePageHandler(readModel);

    const result = await handler.execute(
      new GetPublicSitePageQuery({ siteId: "site-1", slug: "" }),
    );

    expect(result.blocks).toEqual([
      {
        id: "teachers",
        type: "teachers",
        props: {
          teachers: [
            {
              teacherId: "teacher-visible",
              displayName: "Visible",
              imageUrl: "https://cdn.example.test/visible.jpg",
              imageRights: true,
            },
          ],
        },
      },
      {
        id: "testimonials",
        type: "testimonials",
        props: {
          testimonials: [
            { testimonialId: "public", authorName: "Ana", quote: "Excelente", public: true },
          ],
        },
      },
    ]);
  });
});
