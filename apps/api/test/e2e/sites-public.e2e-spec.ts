import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";

type ApiResult = {
  status: number;
  body: Record<string, any>;
  headers: Headers;
};

const RUN = randomUUID().slice(0, 8);
const NOW = new Date("2026-07-28T12:00:00.000Z");

async function call(baseUrl: string, path: string): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : {},
    headers: response.headers,
  };
}

async function createSchoolSite(db: Db, suffix: string) {
  const [school] = await db
    .insert(schema.schools)
    .values({
      slug: `e2e-sites-${RUN}-${suffix}`,
      name: `Academia Sites ${suffix.toUpperCase()}`,
      legalName: `Academia Sites ${suffix.toUpperCase()} SL`,
      taxId: `S${RUN}${suffix}`.slice(0, 9),
      branding: { primaryColor: suffix === "a" ? "#0f766e" : "#7c3aed" },
      defaultLocale: "es-ES",
      supportedLocales: ["es-ES", "en-GB"],
    })
    .returning({ id: schema.schools.id });
  if (!school) throw new Error("No se pudo crear escuela.");

  const [site] = await db
    .insert(schema.sites)
    .values({
      schoolId: school.id,
      status: "published",
      primaryLocale: "es-ES",
      theme: { accentColor: "#f97316" },
      publishedAt: NOW,
    })
    .returning({ id: schema.sites.id });
  if (!site) throw new Error("No se pudo crear sitio.");

  await db.insert(schema.schoolDomains).values({
    schoolId: school.id,
    hostname: `sites-${RUN}-${suffix}.example.test`,
    isPrimary: true,
    verifiedAt: NOW,
  });

  const [page] = await db
    .insert(schema.sitePages)
    .values({
      schoolId: school.id,
      siteId: site.id,
      slug: "inicio",
      locale: "es-ES",
      title: `Inicio ${suffix.toUpperCase()}`,
      metaDescription: `Meta ${suffix.toUpperCase()}`,
      isHome: true,
      position: 0,
      publishedAt: NOW,
    })
    .returning({ id: schema.sitePages.id });
  if (!page) throw new Error("No se pudo crear página.");

  await db.insert(schema.siteBlocks).values([
    {
      schoolId: school.id,
      pageId: page.id,
      type: "teachers",
      position: 0,
      isVisible: true,
      content: {
        teachers: [
          {
            teacherId: `visible-${suffix}`,
            displayName: `Visible ${suffix.toUpperCase()}`,
            imageUrl: "https://cdn.example.test/visible.jpg",
            imageRights: true,
          },
          {
            teacherId: `hidden-${suffix}`,
            displayName: `Oculto ${suffix.toUpperCase()}`,
            imageUrl: "https://cdn.example.test/hidden.jpg",
            imageRights: false,
          },
        ],
      },
    },
    {
      schoolId: school.id,
      pageId: page.id,
      type: "testimonials",
      position: 1,
      isVisible: true,
      content: {
        testimonials: [
          {
            testimonialId: `public-${suffix}`,
            authorName: "Ana",
            quote: `Pública ${suffix.toUpperCase()}`,
            public: true,
          },
          {
            testimonialId: `private-${suffix}`,
            authorName: "Luis",
            quote: `Privada ${suffix.toUpperCase()}`,
            public: false,
          },
        ],
      },
    },
  ]);

  return { schoolId: school.id, siteId: site.id, host: `sites-${RUN}-${suffix}.example.test` };
}

describe("Sites públicos — resolución y contenido", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

    const admin = createAdminDb();
    adminDb = admin.db;
    closeAdminDb = () => admin.client.end({ timeout: 5 });
  });

  afterAll(async () => {
    await app?.close();
    await closeAdminDb?.();
  });

  it("resuelve solo hosts verificados y sirve contenido filtrado por sitio", async () => {
    const schoolA = await createSchoolSite(adminDb, "a");
    const schoolB = await createSchoolSite(adminDb, "b");

    const unknown = await call(baseUrl, "/public/sites/resolve?host=missing.example.test");
    expect(unknown.status).toBe(404);

    const resolvedA = await call(
      baseUrl,
      `/public/sites/resolve?host=${encodeURIComponent(`${schoolA.host}:443`)}`,
    );
    expect(resolvedA.status).toBe(200);
    expect(resolvedA.headers.get("cache-control")).toContain("stale-while-revalidate");
    expect(resolvedA.body.site).toMatchObject({
      id: schoolA.siteId,
      schoolId: schoolA.schoolId,
      schoolName: "Academia Sites A",
    });
    expect(JSON.stringify(resolvedA.body)).not.toContain(schoolB.schoolId);

    const resolvedB = await call(baseUrl, `/public/sites/resolve?host=${schoolB.host}`);
    expect(resolvedB.status).toBe(200);
    expect(resolvedB.body.site).toMatchObject({
      id: schoolB.siteId,
      schoolId: schoolB.schoolId,
      schoolName: "Academia Sites B",
    });

    const pageA = await call(baseUrl, `/public/sites/${schoolA.siteId}/pages/inicio`);
    expect(pageA.status).toBe(200);
    const serialized = JSON.stringify(pageA.body);
    expect(serialized).toContain("visible-a");
    expect(serialized).toContain("public-a");
    expect(serialized).not.toContain("hidden-a");
    expect(serialized).not.toContain("private-a");
    expect(serialized).not.toContain("visible-b");
  });
});
