import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { BadRequestException, ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";
import { OnLeadCapturedStartPlacement } from "../../src/contexts/assessment/application/event-handlers/on-lead-captured.handler.js";
import { LeadCaptured } from "../../src/contexts/people/domain/events/lead.events.js";

/**
 * Recorrido completo de la ola 4 (Tarea 10 del plan): una escuela publica su
 * web con el editor de bloques, responde en su subdominio y en un dominio
 * propio verificado, y el formulario de contacto convierte a un visitante en
 * alumno matriculado en un grupo.
 *
 * Lo que NO se puede recorrer en local queda simulado y documentado en cada
 * paso: la verificación DNS real (la cubre `verify-site-domains.job.spec.ts`
 * con un verificador falso) y el presupuesto de JavaScript de la portada (se
 * mide sobre el build de `apps/sites`, no sobre la API).
 */

type Json = Record<string, any>;

interface ApiResult {
  status: number;
  body: Json;
  cookie: string | null;
  headers: Headers;
}

const RUN = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `e2e-wave4-${RUN}.langopia.test`;
const SITE_HOST = `e2e-wave4-${RUN}.langopia.test`;
const CUSTOM_HOST = `academia-${RUN}.example.test`;
const NOW = new Date("2026-07-28T12:00:00.000Z");

function mergeCookies(setCookie: readonly string[]): string {
  return setCookie.map((one) => one.split(";")[0]!).join("; ");
}

async function call(
  baseUrl: string,
  method: string,
  path: string,
  options: { cookie?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });

  const setCookie = response.headers.getSetCookie();
  const text = await response.text();
  const body = text.length > 0 && response.headers.get("content-type")?.includes("json")
    ? JSON.parse(text)
    : text.length > 0
      ? { text }
      : {};
  return { status: response.status, body, cookie: setCookie.length > 0 ? mergeCookies(setCookie) : null, headers: response.headers };
}

async function createCredential(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<void> {
  const authUserId = randomUUID();
  const now = new Date();
  const hash = await hashPassword(params.password);

  await db.insert(schema.authUsers).values({
    id: authUserId,
    name: params.name,
    email: params.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.authAccounts).values({
    id: randomUUID(),
    accountId: authUserId,
    providerId: "credential",
    userId: authUserId,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
}

describe("Ola 4 — recorrido completo: web pública, dominios y embudo de matrícula", () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: (errors) =>
          new BadRequestException({
            message: "validation_failed",
            errors: errors.flatMap((error) =>
              Object.values(error.constraints ?? {}).map((message) => ({ field: error.property, message })),
            ),
          }),
      }),
    );
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

  it("publica la web, la sirve por dominio y convierte un candidato en alumno matriculado", async () => {
    // ── Alta de la escuela y su dueña ────────────────────────────────────
    const ownerEmail = `duena@${EMAIL_DOMAIN}`;
    const ownerPassword = "Recorrido-ola4-2026!";
    await createCredential(adminDb, { email: ownerEmail, name: "Dueña Ola 4", password: ownerPassword });

    const signIn = await call(baseUrl, "POST", "/auth/sign-in/email", {
      body: { email: ownerEmail, password: ownerPassword },
    });
    expect(signIn.status).toBe(200);
    const ownerCookie = signIn.cookie;
    if (!ownerCookie) throw new Error("La dueña no recibió cookie de sesión.");

    const registered = await call(baseUrl, "POST", "/schools/register", {
      cookie: ownerCookie,
      body: { slug: `e2e-wave4-${RUN}`, name: "Academia E2E Ola 4" },
    });
    expect(registered.status).toBe(201);
    const schoolId = registered.body.schoolId as string;

    // La web se edita desde el panel, pero el sitio en borrador y su página
    // de inicio nacen con la escuela (el seed los crea igual): aquí se
    // siembran directamente para no acoplar el recorrido a otro caso de uso.
    const [site] = await adminDb
      .insert(schema.sites)
      .values({ schoolId, status: "draft", primaryLocale: "es-ES" })
      .returning({ id: schema.sites.id });
    if (!site) throw new Error("No se pudo crear el sitio.");

    const [homePage] = await adminDb
      .insert(schema.sitePages)
      .values({
        schoolId,
        siteId: site.id,
        slug: "inicio",
        locale: "es-ES",
        title: "Inicio",
        metaDescription: "Cursos de idiomas de la Academia E2E Ola 4.",
        isHome: true,
        position: 0,
        publishedAt: NOW,
      })
      .returning({ id: schema.sitePages.id });
    if (!homePage) throw new Error("No se pudo crear la página de inicio.");

    // Banco de nivelación en inglés: el envío automático de la prueba al
    // capturar el candidato lo necesita para abrir la primera pregunta.
    await adminDb.insert(schema.placementItems).values(
      (["grammar", "reading"] as const).flatMap((skill) =>
        (["A2", "B1", "B2"] as const).map((level) => ({
          schoolId,
          language: "en",
          level,
          skill,
          difficulty: 5000,
          prompt: { question: `Pregunta ${skill} ${level}`, options: ["correcta", "incorrecta"] },
          solution: { correct: 0 },
        })),
      ),
    );

    // Curso y grupo reales: el bloque de cursos y la matrícula final del
    // recorrido tiran del catálogo, no de texto libre.
    const [course] = await adminDb
      .insert(schema.courses)
      .values({
        schoolId,
        code: `W4-${RUN}`,
        language: "en",
        level: "B1",
        priceCents: 12000,
      })
      .returning({ id: schema.courses.id });
    if (!course) throw new Error("No se pudo crear el curso.");

    const [group] = await adminDb
      .insert(schema.groups)
      .values({ schoolId, courseId: course.id, name: "Grupo B1 tarde", startsOn: "2026-09-01" })
      .returning({ id: schema.groups.id });
    if (!group) throw new Error("No se pudo crear el grupo.");

    // ── Pasos 1-2 del recorrido: editar la portada y publicarla ─────────
    const editable = await call(baseUrl, "GET", "/sites/editor", { cookie: ownerCookie });
    expect(editable.status).toBe(200);
    const editablePage = (editable.body.pages as Json[]).find((page) => page.id === homePage.id);
    expect(editablePage).toBeTruthy();

    const saved = await call(baseUrl, "PUT", `/sites/editor/pages/${homePage.id}/blocks`, {
      cookie: ownerCookie,
      body: {
        blocks: [
          {
            id: randomUUID(),
            type: "hero",
            props: {
              headline: "Inglés que se usa desde la primera clase",
              subtitle: "Grupos reducidos, online y presencial.",
              image: { url: "https://cdn.example.test/hero.jpg", alt: "Clase de inglés" },
              callToAction: { label: "Pide información", href: "/contacto" },
            },
          },
          { id: randomUUID(), type: "courses", props: { source: { kind: "all_active" } } },
          {
            id: randomUUID(),
            type: "teachers",
            props: {
              teachers: [
                {
                  teacherId: randomUUID(),
                  displayName: "Profesora Consentida",
                  imageUrl: "https://cdn.example.test/ana.jpg",
                  imageRights: true,
                },
                {
                  teacherId: randomUUID(),
                  displayName: "Profesor Sin Consentimiento",
                  imageUrl: "https://cdn.example.test/luis.jpg",
                  imageRights: false,
                },
              ],
            },
          },
          {
            id: randomUUID(),
            type: "contact",
            props: { title: "Pide información", submitLabel: "Enviar", leadSource: "school_site" },
          },
        ],
      },
    });
    expect(saved.status).toBe(200);

    const published = await call(baseUrl, "POST", "/sites/editor/publish", { cookie: ownerCookie });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("published");

    // ── Paso 2-3: la web responde en el subdominio y filtra consentimientos
    await adminDb.insert(schema.schoolDomains).values({
      schoolId,
      hostname: SITE_HOST,
      isPrimary: true,
      status: "verified",
      verifiedAt: NOW,
    });

    const resolved = await call(baseUrl, "GET", `/public/sites/resolve?host=${SITE_HOST}`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.site).toMatchObject({ id: site.id, schoolId, schoolName: "Academia E2E Ola 4" });

    const publicPage = await call(baseUrl, "GET", `/public/sites/${site.id}/pages/inicio`);
    expect(publicPage.status).toBe(200);
    const serializedPage = JSON.stringify(publicPage.body);
    expect(serializedPage).toContain("Inglés que se usa desde la primera clase");
    expect(serializedPage).toContain("Profesora Consentida");
    // Nadie aparece en la web sin haber consentido los derechos de imagen.
    expect(serializedPage).not.toContain("Profesor Sin Consentimiento");

    // ── Pasos 4-6: dominio propio, verificación y aislamiento ────────────
    const added = await call(baseUrl, "POST", "/sites/domains", {
      cookie: ownerCookie,
      body: { hostname: CUSTOM_HOST },
    });
    expect(added.status).toBe(201);
    expect(added.body.status).toBe("pending");
    expect(added.body.verification).toMatchObject({
      type: "TXT",
      name: `_langopia.${CUSTOM_HOST}`,
    });
    expect(typeof added.body.verification.value).toBe("string");

    // Mientras el dominio no está verificado, NO resuelve: jamás la web de
    // otra escuela ni una web a medio verificar.
    const unverified = await call(baseUrl, "GET", `/public/sites/resolve?host=${CUSTOM_HOST}`);
    expect(unverified.status).toBe(404);

    // La verificación DNS real y la emisión del certificado no se pueden
    // recorrer en local (hace falta un dominio con DNS de verdad); la comprueba
    // el trabajo `verify-site-domains` con su spec unitario. Aquí se simula el
    // resultado: TXT encontrado, dominio verificado.
    await adminDb
      .update(schema.schoolDomains)
      .set({ status: "verified", verifiedAt: NOW })
      .where(eq(schema.schoolDomains.hostname, CUSTOM_HOST));

    const customDomain = await call(baseUrl, "GET", `/public/sites/resolve?host=${CUSTOM_HOST}`);
    expect(customDomain.status).toBe(200);
    expect(customDomain.body.site.id).toBe(site.id);

    // ── Pasos 7-8: el formulario crea el candidato y dispara la prueba ───
    // Espía al manejador de `assessment`: la prueba de nivelación llega por
    // EVENTO (`people` publica `LeadCaptured`, `assessment` lo escucha), no
    // por una llamada directa entre contextos.
    const placementHandler = moduleRef.get(OnLeadCapturedStartPlacement);
    const placementSpy = vi.spyOn(placementHandler, "handle");

    const captured = await call(baseUrl, "POST", "/public/leads", {
      body: {
        siteId: site.id,
        name: "Candidata Ola 4",
        email: `candidata@${EMAIL_DOMAIN}`,
        locale: "es-ES",
        interestedLanguage: "en",
        declaredLevel: "A2",
        sourcePage: "/contacto",
      },
    });
    expect(captured.status).toBe(201);
    const leadId = captured.body.leadId as string;

    expect(placementSpy).toHaveBeenCalledOnce();
    const capturedEvent = placementSpy.mock.calls[0]![0] as LeadCaptured;
    expect(capturedEvent).toBeInstanceOf(LeadCaptured);
    expect(capturedEvent.payload()).toMatchObject({ leadId, interestedLanguage: "en" });

    const funnelBefore = await call(baseUrl, "GET", "/leads", { cookie: ownerCookie });
    expect(funnelBefore.status).toBe(200);
    const leadInFunnel = (funnelBefore.body as Json[]).find((lead) => lead.id === leadId);
    expect(leadInFunnel).toMatchObject({ status: "new", sourcePage: "/contacto", interestedLanguage: "en" });

    // ── Paso 9: la prueba hecha deja el nivel sugerido en el embudo ──────
    // La candidata hace la nivelación de verdad: el equipo la administra por
    // HTTP (igual que en la ola 2) y, al terminar, `assessment` publica
    // `PlacementTestFinished` y `people` lo escucha para volcar el nivel en
    // el candidato — sin simulación ni escritura directa en base de datos.
    let placement = await call(baseUrl, "POST", "/assessment/placement/start", {
      cookie: ownerCookie,
      body: { studentProfileId: leadId, language: "en" },
    });
    expect(placement.status).toBe(201);
    let placementBody = placement.body;
    for (let i = 0; i < 30 && !placementBody.finished; i += 1) {
      placement = await call(baseUrl, "POST", `/assessment/placement/${placementBody.testId}/answer`, {
        cookie: ownerCookie,
        body: {
          itemId: placementBody.nextQuestion.itemId,
          snapshot: placementBody.snapshot,
          response: { correct: 0 },
        },
      });
      expect(placement.status).toBe(201);
      placementBody = placement.body;
    }
    expect(placementBody.finished).toBe(true);
    expect(placementBody.result.level).toBeTruthy();

    const funnelAfter = await call(baseUrl, "GET", "/leads", { cookie: ownerCookie });
    const leadWithLevel = (funnelAfter.body as Json[]).find((lead) => lead.id === leadId);
    // El nivel del embudo es el que propuso la prueba, volcado por el oyente
    // de `PlacementTestFinished`. El evento no lleva puntuación numérica:
    // `placementScore` queda a null hasta que la escuela confirme o corrija.
    expect(leadWithLevel).toMatchObject({
      status: "placement_done",
      placementLevel: placementBody.result.level,
      placementScore: null,
    });

    // ── Paso 10: conversión en alumno y matrícula en el grupo ───────────
    const converted = await call(baseUrl, "POST", `/leads/${leadId}/convert`, {
      cookie: ownerCookie,
      body: { dateOfBirth: "1992-05-10", nativeLanguage: "es", targetLanguage: "en" },
    });
    expect(converted.status).toBe(200);
    const studentId = converted.body.studentId as string;
    expect(studentId).toBeTruthy();

    const enrolled = await call(baseUrl, "POST", `/groups/${group.id}/enrolments`, {
      cookie: ownerCookie,
      body: { studentId },
    });
    expect(enrolled.status).toBe(201);

    const funnelFinal = await call(baseUrl, "GET", "/leads", { cookie: ownerCookie });
    const leadConverted = (funnelFinal.body as Json[]).find((lead) => lead.id === leadId);
    expect(leadConverted?.status).toBe("converted");

    // Paso 11 (presupuesto de < 50 KB de JavaScript en la portada) se mide
    // sobre el build de `apps/sites`, no sobre la API: es la comprobación
    // `dist/client` tras `npm run build --workspace sites`.
  });
});
