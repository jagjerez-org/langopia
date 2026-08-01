import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { BadRequestException, type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";
import {
  CONTENT_GENERATOR_PORT,
  type ContentGeneratorPort,
  type GenerationCost,
} from "../../src/contexts/learning/domain/ports/content-generator.port.js";
import {
  WRITING_CORRECTOR_PORT,
  type WritingCorrectorPort,
} from "../../src/contexts/assessment/domain/ports/writing-corrector.port.js";

type Json = Record<string, any>;

interface ApiResult {
  status: number;
  body: Json;
  cookie: string | null;
}

const RUN = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `e2e-wave2-${RUN}.langopia.test`;

const WRITING_CRITERIA = [
  { key: "adecuacion", label: "Adecuación a la tarea", weight: 0.25, descriptors: ["Cumple la tarea"] },
  { key: "coherencia", label: "Coherencia y cohesión", weight: 0.25, descriptors: ["Texto organizado"] },
  { key: "lexico", label: "Riqueza léxica", weight: 0.25, descriptors: ["Vocabulario suficiente"] },
  { key: "correccion", label: "Corrección gramatical", weight: 0.25, descriptors: ["Errores ocasionales"] },
];

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
  if (options.cookie) headers["cookie"] = options.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const setCookie = response.headers.getSetCookie();
  const text = await response.text();
  const body = text.length > 0 ? JSON.parse(text) : {};
  return { status: response.status, body, cookie: setCookie.length > 0 ? mergeCookies(setCookie) : null };
}

async function createBetterAuthCredential(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<string> {
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

  return authUserId;
}

async function attachCredentialToDomainUser(
  db: Db,
  params: { email: string; name: string; password: string },
): Promise<void> {
  const authUserId = await createBetterAuthCredential(db, params);
  await db
    .update(schema.users)
    .set({ authUserId, emailVerifiedAt: new Date() })
    .where(eq(schema.users.email, params.email));
}

function dateYearsAgo(years: number, from: Date): string {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

class FakeContentGenerator implements ContentGeneratorPort {
  unitCalls = 0;
  exerciseCalls = 0;

  async generateUnit(): Promise<{ title: string; description: string; body: string; cost: GenerationCost }> {
    this.unitCalls += 1;
    return {
      title: "Español B1: resolver una incidencia en un viaje",
      description: "Unidad B1 para practicar reclamaciones educadas y soluciones.",
      body: "Una unidad práctica sobre cómo explicar un problema de viaje, pedir alternativas y cerrar un acuerdo.",
      cost: { inputTokens: 900, outputTokens: 700, costCents: 70, model: "fake-content-e2e" },
    };
  }

  async generateExercises(): Promise<{ exercises: unknown[]; cost: GenerationCost }> {
    this.exerciseCalls += 1;
    return {
      exercises: [
        {
          type: "cloze",
          prompt: {
            text: "Cuando llegué al hotel, la habitación no {{1}} lista.",
            blanks: [{ id: 1, hint: "verbo estar" }],
            openEnded: true,
          },
          solution: { "1": ["estaba"] },
        },
        {
          type: "multiple_choice",
          prompt: { question: "¿Qué frase es más adecuada para reclamar?", options: ["Deme otra ya", "¿Podría revisarlo, por favor?", "Esto es fatal"] },
          solution: { correct: 1 },
        },
        {
          type: "matching",
          prompt: { left: ["retraso", "equipaje", "reserva"], right: ["demora", "maleta", "confirmación"] },
          solution: { pairs: [[0, 0], [1, 1], [2, 2]] },
        },
        {
          type: "ordering",
          prompt: { tokens: ["Podría", "ayudarme", "con", "la", "reserva"] },
          solution: { order: [0, 1, 2, 3, 4] },
        },
        {
          type: "reading_comprehension",
          prompt: {
            passage: "El viajero escribió a recepción porque su reserva aparecía cancelada, aunque ya había pagado la señal.",
            question: "¿Cuál era el problema principal?",
            options: ["La reserva aparecía cancelada", "No sabía llegar al hotel", "Perdió el pasaporte"],
          },
          solution: { correct: 0 },
        },
        {
          type: "written_production",
          prompt: {
            task: "Escribe un correo breve al hotel para explicar el problema y pedir una solución.",
            minWords: 80,
            maxWords: 140,
            register: "formal",
          },
        },
      ],
      cost: { inputTokens: 1200, outputTokens: 1100, costCents: 50, model: "fake-content-e2e" },
    };
  }

  async correctWriting(): Promise<{ score: number; feedback: string; byCriterion: Record<string, number>; cost: GenerationCost }> {
    throw new Error("Este puerto no corrige escritura en assessment.");
  }
}

class FakeWritingCorrector implements WritingCorrectorPort {
  async correct(): Promise<{ feedback: string; byCriterion: Record<string, number>; cost: GenerationCost }> {
    return {
      feedback: "Propuesta automática: cumple la tarea, pero puede mejorar precisión.",
      byCriterion: { adecuacion: 4, coherencia: 3, lexico: 3, correccion: 3 },
      cost: { inputTokens: 400, outputTokens: 120, costCents: 8, model: "fake-writing-e2e" },
    };
  }
}

describe("Ola 2 — recorrido completo de contenido, evaluación y créditos (Tarea 13)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;
  let generator: FakeContentGenerator;

  const startedAt = new Date();

  beforeAll(async () => {
    generator = new FakeContentGenerator();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONTENT_GENERATOR_PORT)
      .useValue(generator)
      .overrideProvider(WRITING_CORRECTOR_PORT)
      .useValue(new FakeWritingCorrector())
      .compile();

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

  it("genera, revisa, publica, resuelve, firma, calcula progreso, nivela y rechaza generación sin créditos", async () => {
    const ownerEmail = `duena@${EMAIL_DOMAIN}`;
    const ownerPassword = "Recorrido-ola2-2026!";
    await createBetterAuthCredential(adminDb, {
      email: ownerEmail,
      name: "Dueña Ola 2",
      password: ownerPassword,
    });

    const ownerSignIn = await call(baseUrl, "POST", "/auth/sign-in/email", {
      body: { email: ownerEmail, password: ownerPassword },
    });
    expect(ownerSignIn.status).toBe(200);
    const ownerCookie = ownerSignIn.cookie;
    if (!ownerCookie) throw new Error("La dueña no recibió cookie de sesión.");

    const registered = await call(baseUrl, "POST", "/schools/register", {
      cookie: ownerCookie,
      body: { slug: `e2e-wave2-${RUN}`, name: "Academia E2E Ola 2" },
    });
    expect(registered.status).toBe(201);
    const schoolId = registered.body.schoolId as string;

    await adminDb.update(schema.schools).set({ aiCreditsBalance: 100, aiHardLimit: true }).where(eq(schema.schools.id, schoolId));
    await adminDb.insert(schema.rubrics).values({
      schoolId,
      code: "mcer-escrita",
      name: "Producción escrita (MCER)",
      maxScore: 20,
      criteria: WRITING_CRITERIA,
    });
    await adminDb.insert(schema.placementItems).values(
      ["grammar", "reading"].flatMap((skill) =>
        ["A2", "B1", "B2"].map((level) => ({
          schoolId,
          language: "es",
          level: level as "A2" | "B1" | "B2",
          skill,
          difficulty: 5000,
          prompt: { question: `Pregunta ${skill} ${level}`, options: ["correcta", "incorrecta"] },
          solution: { correct: 0 },
        })),
      ),
    );

    const teacherEmail = `profesora@${EMAIL_DOMAIN}`;
    const hired = await call(baseUrl, "POST", "/teachers", {
      cookie: ownerCookie,
      body: {
        name: "Profesora Ola 2",
        email: teacherEmail,
        tier: "professional",
        hourlyRateCents: 2500,
        contractedHoursPerWeek: 20,
        hiredAt: dateYearsAgo(2, startedAt),
        locale: "es-ES",
      },
    });
    expect(hired.status).toBe(201);
    const teacherId = hired.body.teacherId as string;
    const teacherPassword = "Profesora-ola2-2026!";
    await attachCredentialToDomainUser(adminDb, {
      email: teacherEmail,
      name: "Profesora Ola 2",
      password: teacherPassword,
    });

    const teacherSignIn = await call(baseUrl, "POST", "/auth/sign-in/email", {
      body: { email: teacherEmail, password: teacherPassword },
    });
    expect(teacherSignIn.status).toBe(200);
    const teacherCookie = teacherSignIn.cookie;
    if (!teacherCookie) throw new Error("La profesora no recibió cookie de sesión.");

    const course = await call(baseUrl, "POST", "/courses", {
      cookie: ownerCookie,
      body: {
        code: `ESP-B1-${RUN}`,
        language: "es",
        level: "B1",
        modality: "group",
        maxStudents: 12,
        priceCents: 9000,
        currency: "EUR",
        translations: [{ locale: "es-ES", name: "Español B1 grupo" }],
      },
    });
    expect(course.status).toBe(201);

    const group = await call(baseUrl, "POST", "/groups", {
      cookie: ownerCookie,
      body: {
        courseId: course.body.courseId,
        teacherId,
        name: "Español B1 tarde",
        startsOn: startedAt.toISOString().slice(0, 10),
      },
    });
    expect(group.status).toBe(201);
    const groupId = group.body.groupId as string;

    const studentEmail = `alumna@${EMAIL_DOMAIN}`;
    const studentPassword = "Alumna-ola2-2026!";
    const student = await call(baseUrl, "POST", "/students", {
      cookie: ownerCookie,
      body: {
        name: "Alumna Ola 2",
        email: studentEmail,
        dateOfBirth: dateYearsAgo(25, startedAt),
        nativeLanguage: "en",
        targetLanguage: "es",
        currentLevel: "B1",
        locale: "es-ES",
      },
    });
    expect(student.status).toBe(201);
    const studentId = student.body.studentId as string;
    await attachCredentialToDomainUser(adminDb, {
      email: studentEmail,
      name: "Alumna Ola 2",
      password: studentPassword,
    });

    const enrolment = await call(baseUrl, "POST", `/groups/${groupId}/enrolments`, {
      cookie: ownerCookie,
      body: { studentId },
    });
    expect(enrolment.status).toBe(201);

    const generated = await call(baseUrl, "POST", "/learning/units/generate", {
      cookie: ownerCookie,
      body: {
        code: `VIAJES-B1-${RUN}`,
        language: "es",
        level: "B1",
        topic: "Resolver una incidencia en un viaje",
        skills: ["grammar", "vocabulary", "reading", "writing"],
        primaryLocale: "es-ES",
        exerciseTypes: ["cloze", "multiple_choice", "matching", "ordering", "reading_comprehension", "written_production"],
      },
    });
    expect(generated.status).toBe(201);
    expect(generated.body.status).toBe("in_review");
    const unitId = generated.body.contentUnitId as string;

    const schoolCredits = await adminDb.execute<{ ai_credits_balance: number }>(sql`
      SELECT ai_credits_balance FROM schools WHERE id = ${schoolId}
    `);
    expect(schoolCredits[0]?.ai_credits_balance).toBe(88);

    const generationRows = await adminDb.execute<{ count: string; credits: string; cost: string }>(sql`
      SELECT count(*)::text AS count, sum(credits_charged)::text AS credits, sum(cost_cents)::text AS cost
      FROM ai_generations
      WHERE school_id = ${schoolId} AND content_unit_id = ${unitId} AND status = 'succeeded'
    `);
    expect(Number(generationRows[0]?.count)).toBe(2);
    expect(Number(generationRows[0]?.credits)).toBe(12);
    expect(Number(generationRows[0]?.cost)).toBe(120);

    const detail = await call(baseUrl, "GET", `/learning/units/${unitId}`, { cookie: ownerCookie });
    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe("in_review");
    const exercises = detail.body.exercises as Array<Json>;
    expect(exercises).toHaveLength(6);

    const edited = await call(baseUrl, "PATCH", `/learning/units/${unitId}/exercises/${exercises[1]!.exerciseId}`, {
      cookie: ownerCookie,
      body: {
        prompt: {
          question: "¿Qué frase editada es más adecuada para reclamar con educación?",
          options: ["Deme otra ya", "¿Podría revisarlo, por favor?", "Esto es fatal"],
        },
        solution: { correct: 1 },
      },
    });
    expect(edited.status).toBe(200);
    const editedDetail = await call(baseUrl, "GET", `/learning/units/${unitId}`, { cookie: ownerCookie });
    expect(editedDetail.status).toBe(200);
    expect(
      (editedDetail.body.exercises as Array<Json>).find((exercise) => exercise.exerciseId === exercises[1]!.exerciseId),
    ).toMatchObject({
      prompt: {
        question: "¿Qué frase editada es más adecuada para reclamar con educación?",
        options: ["Deme otra ya", "¿Podría revisarlo, por favor?", "Esto es fatal"],
      },
      solution: { correct: 1 },
    });

    const publishTargets = await call(baseUrl, "GET", `/learning/units/${unitId}/publish-targets`, {
      cookie: ownerCookie,
    });
    expect(publishTargets.status).toBe(200);
    expect((publishTargets.body as Json[]).find((target) => target.groupId === groupId)).toMatchObject({
      eligible: true,
      language: "es",
      level: "B1",
    });

    const published = await call(baseUrl, "POST", `/learning/units/${unitId}/publish`, {
      cookie: ownerCookie,
      body: { groupIds: [groupId] },
    });
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ status: "published", courseId: course.body.courseId, groupIds: [groupId] });

    const studentSignIn = await call(baseUrl, "POST", "/auth/sign-in/email", {
      body: { email: studentEmail, password: studentPassword },
    });
    expect(studentSignIn.status).toBe(200);
    const studentCookie = studentSignIn.cookie;
    if (!studentCookie) throw new Error("La alumna no recibió cookie de sesión.");

    const toDo = await call(baseUrl, "GET", `/assessments/students/${studentId}/exercises`, {
      cookie: studentCookie,
    });
    expect(toDo.status).toBe(200);
    const studentExercises = toDo.body as Array<Json>;
    expect(studentExercises.map((exercise) => exercise.type)).toEqual([
      "cloze",
      "multiple_choice",
      "matching",
      "ordering",
      "reading_comprehension",
      "written_production",
    ]);
    expect(studentExercises.find((exercise) => exercise.exerciseId === exercises[1]!.exerciseId)).toMatchObject({
      prompt: {
        question: "¿Qué frase editada es más adecuada para reclamar con educación?",
        options: ["Deme otra ya", "¿Podría revisarlo, por favor?", "Esto es fatal"],
      },
    });

    const responsesByType: Record<string, Json> = {
      cloze: { "1": "estaba" },
      multiple_choice: { correct: 1 },
      matching: { pairs: [[0, 0], [1, 1], [2, 2]] },
      ordering: { order: [0, 1, 2, 3, 4] },
      reading_comprehension: { correct: 0 },
      written_production: {
        text: "Estimado equipo del hotel: escribo porque mi reserva aparece cancelada aunque pagué la señal. ¿Podrían revisarlo y ofrecerme una habitación equivalente o confirmar la devolución? Gracias por su ayuda.",
      },
    };

    const attempts: Array<Json> = [];
    for (const exercise of studentExercises) {
      const submitted = await call(baseUrl, "POST", "/assessments/attempts", {
        cookie: studentCookie,
        body: {
          exerciseId: exercise.exerciseId,
          studentProfileId: studentId,
          response: responsesByType[exercise.type as string],
          startedAt: new Date(startedAt.getTime() + 60_000).toISOString(),
          durationMs: 45_000,
        },
      });
      expect(submitted.status).toBe(201);
      attempts.push({ ...submitted.body, type: exercise.type });
    }

    const automaticAttempts = attempts.filter((attempt) => attempt.type !== "written_production");
    expect(automaticAttempts).toHaveLength(5);
    for (const attempt of automaticAttempts) {
      expect(attempt.status).toBe("ai_graded");
      expect(attempt.aiScore).toBe(attempt.maxScore);
      expect(attempt.requiresTeacherValidation).toBe(false);
    }

    const writingAttempt = attempts.find((attempt) => attempt.type === "written_production");
    expect(writingAttempt).toMatchObject({
      status: "ai_graded",
      requiresTeacherValidation: true,
      aiFeedback: "Propuesta automática: cumple la tarea, pero puede mejorar precisión.",
    });
    expect(writingAttempt?.attemptId).toBeTruthy();

    const progressBeforeSignature = await call(baseUrl, "GET", `/assessments/students/${studentId}/progress`, {
      cookie: studentCookie,
    });
    expect(progressBeforeSignature.status).toBe(200);
    expect(progressBeforeSignature.body.completedExercises).toBe(6);
    expect(progressBeforeSignature.body.validatedAttempts).toBe(0);
    expect(progressBeforeSignature.body.averageScore).toBeNull();

    const pending = await call(baseUrl, "GET", "/assessments/attempts/pending", { cookie: teacherCookie });
    expect(pending.status).toBe(200);
    expect((pending.body as Json[]).some((attempt) => attempt.attemptId === writingAttempt!.attemptId)).toBe(true);

    const signed = await call(baseUrl, "POST", `/assessments/attempts/${writingAttempt!.attemptId}/validate`, {
      cookie: teacherCookie,
      body: { teacherScore: 18, teacherFeedback: "Firmado tras revisar el correo; subo la nota por adecuación." },
    });
    expect(signed.status).toBe(201);
    expect(signed.body.status).toBe("teacher_validated");

    const progressAfterSignature = await call(baseUrl, "GET", `/assessments/students/${studentId}/progress`, {
      cookie: studentCookie,
    });
    expect(progressAfterSignature.status).toBe(200);
    expect(progressAfterSignature.body.validatedAttempts).toBe(1);
    expect(progressAfterSignature.body.averageScore).toBe(0.9);
    expect(progressAfterSignature.body.skillBreakdown).toEqual([
      { skill: "writing", averageScore: 0.9, attemptCount: 1 },
    ]);

    let placement = await call(baseUrl, "POST", "/assessment/placement/start", {
      cookie: ownerCookie,
      body: { studentProfileId: studentId, language: "es" },
    });
    expect(placement.status).toBe(201);
    expect(placement.body.finished).toBe(false);
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
    expect(placementBody.result.questionsAsked).toBeGreaterThanOrEqual(6);
    expect(Object.keys(placementBody.result.skillLevels).sort()).toEqual(["grammar", "reading"]);

    await adminDb.update(schema.schools).set({ aiCreditsBalance: 0, aiHardLimit: true }).where(eq(schema.schools.id, schoolId));
    const callsBeforeRejection = generator.unitCalls + generator.exerciseCalls;
    const rejected = await call(baseUrl, "POST", "/learning/units/generate", {
      cookie: ownerCookie,
      body: {
        code: `SIN-CREDITOS-${RUN}`,
        language: "es",
        level: "B1",
        topic: "Intento sin créditos",
        skills: ["grammar"],
        primaryLocale: "es-ES",
        exerciseTypes: ["multiple_choice"],
      },
    });
    expect(rejected.status).toBe(409);
    expect(generator.unitCalls + generator.exerciseCalls).toBe(callsBeforeRejection);
  });
});
