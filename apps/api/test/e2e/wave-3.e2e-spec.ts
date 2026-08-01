import "reflect-metadata";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { BadRequestException, type INestApplication, ValidationPipe } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { hashPassword } from "better-auth/crypto";
import { ClsService } from "nestjs-cls";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminDb, schema, type Db } from "@langopia/db";
import { AppModule } from "../../src/app.module.js";
import { OnConsentWithdrawnDeleteTranscripts } from "../../src/contexts/classroom/application/event-handlers/on-consent-withdrawn.handler.js";
import { StartTranscriptionCommand } from "../../src/contexts/classroom/application/commands/start-transcription/start-transcription.command.js";
import {
  TRANSCRIPTION_PORT,
  type StartLiveTranscriptionRequest,
  type StartLiveTranscriptionResult,
  type TranscriptionPort,
} from "../../src/contexts/classroom/domain/ports/transcription.port.js";
import { CLOCK, type Clock } from "../../src/contexts/shared/domain/ports/clock.port.js";
import {
  CLS_MEMBERSHIP_ID,
  CLS_ROLES,
  CLS_SCHOOL_ID,
} from "../../src/contexts/shared/infrastructure/tenant/cls-tenant-context.js";
import { ConsentWithdrawn } from "../../src/contexts/people/domain/events/student.events.js";

type Json = Record<string, any>;

interface ApiResult {
  status: number;
  body: Json;
  cookie: string | null;
  headers: Headers;
}

type Persona = {
  userId: string;
  membershipId: string;
  profileId?: string;
};

type SchoolFixture = {
  schoolId: string;
  owner: Persona;
  teacher: Persona;
  adult: Persona;
  minor: Persona;
  guardian: Persona;
  courseId: string;
  groupId: string;
  postSessionSurveyId: string;
  npsSurveyId: string;
  readySessionId: string;
  blockedSessionId: string;
  absentSessionIds: string[];
};

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
}

class FakeTranscriptionProvider implements TranscriptionPort {
  readonly starts: StartLiveTranscriptionRequest[] = [];

  async startLiveTranscription(
    request: StartLiveTranscriptionRequest,
  ): Promise<StartLiveTranscriptionResult> {
    this.starts.push(request);
    return { providerRef: `fake-livekit-${request.transcriptId}` };
  }
}

const RUN = randomUUID().slice(0, 8);
const EMAIL_DOMAIN = `e2e-wave3-${RUN}.langopia.test`;
const NOW = new Date("2026-07-28T10:00:00.000Z");
const OWNER_PASSWORD = "Recorrido-ola3-2026!";

function mergeCookies(setCookie: readonly string[]): string {
  return setCookie.map((one) => one.split(";")[0]!).join("; ");
}

async function call(
  baseUrl: string,
  method: string,
  path: string,
  options: { cookie?: string; authorization?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.cookie) headers.cookie = options.cookie;
  if (options.authorization) headers.authorization = options.authorization;
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
  return {
    status: response.status,
    body,
    cookie: setCookie.length > 0 ? mergeCookies(setCookie) : null,
    headers: response.headers,
  };
}

async function createCredential(
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

async function createPersona(
  db: Db,
  params: {
    schoolId: string;
    role: "owner" | "admin" | "teacher" | "student" | "guardian";
    name: string;
    email: string;
    password?: string;
  },
): Promise<Persona> {
  const authUserId = params.password
    ? await createCredential(db, {
        email: params.email,
        name: params.name,
        password: params.password,
      })
    : null;
  const [user] = await db
    .insert(schema.users)
    .values({
      authUserId,
      email: params.email,
      emailVerifiedAt: params.password ? NOW : null,
      name: params.name,
      locale: "es-ES",
      timezone: "Europe/Madrid",
      authProvider: "password",
      lastSeenAt: NOW,
    })
    .returning({ id: schema.users.id });
  if (!user) throw new Error("No se pudo crear usuario E2E.");

  const [membership] = await db
    .insert(schema.memberships)
    .values({
      schoolId: params.schoolId,
      userId: user.id,
      role: params.role,
      status: "active",
      locale: "es-ES",
      joinedAt: NOW,
    })
    .returning({ id: schema.memberships.id });
  if (!membership) throw new Error("No se pudo crear membresía E2E.");

  return { userId: user.id, membershipId: membership.id };
}

async function createSchoolFixture(db: Db, suffix: string): Promise<SchoolFixture> {
  const [school] = await db
    .insert(schema.schools)
    .values({
      slug: `e2e-wave3-${RUN}-${suffix}`,
      name: `Academia Ola 3 ${suffix}`,
      legalName: `Academia Ola 3 ${suffix} SL`,
      taxId: `B${RUN}${suffix}`.slice(0, 9),
      dataRetentionDays: 90,
      aiCreditsBalance: 100,
      aiHardLimit: true,
    })
    .returning({ id: schema.schools.id });
  if (!school) throw new Error("No se pudo crear escuela E2E.");

  const owner = await createPersona(db, {
    schoolId: school.id,
    role: "owner",
    name: `Dueña Ola 3 ${suffix}`,
    email: `duena-${suffix}@${EMAIL_DOMAIN}`,
    password: OWNER_PASSWORD,
  });
  const teacher = await createPersona(db, {
    schoolId: school.id,
    role: "teacher",
    name: `Profesora Ola 3 ${suffix}`,
    email: `profesora-${suffix}@${EMAIL_DOMAIN}`,
  });
  const adult = await createPersona(db, {
    schoolId: school.id,
    role: "student",
    name: suffix === "a" ? "Alumno en riesgo Ola 3" : "Alumno otra escuela Ola 3",
    email: `alumno-${suffix}@${EMAIL_DOMAIN}`,
    password: `Alumno-ola3-${suffix}-2026!`,
  });
  const minor = await createPersona(db, {
    schoolId: school.id,
    role: "student",
    name: `Menor Ola 3 ${suffix}`,
    email: `menor-${suffix}@${EMAIL_DOMAIN}`,
  });
  const guardian = await createPersona(db, {
    schoolId: school.id,
    role: "guardian",
    name: `Tutora Ola 3 ${suffix}`,
    email: `tutora-${suffix}@${EMAIL_DOMAIN}`,
  });

  const [teacherProfile] = await db
    .insert(schema.teacherProfiles)
    .values({
      schoolId: school.id,
      membershipId: teacher.membershipId,
      tier: "professional",
      hourlyRateCents: 2500,
      contractedHoursWeek: 20,
      hiredAt: "2024-09-01",
      status: "active",
    })
    .returning({ id: schema.teacherProfiles.id });
  const [adultProfile] = await db
    .insert(schema.studentProfiles)
    .values({
      schoolId: school.id,
      membershipId: adult.membershipId,
      dateOfBirth: "1999-02-03",
      guardianRequired: false,
      nativeLanguage: "en",
      targetLanguage: "es",
      currentLevel: "B1",
      status: "active",
    })
    .returning({ id: schema.studentProfiles.id });
  const [minorProfile] = await db
    .insert(schema.studentProfiles)
    .values({
      schoolId: school.id,
      membershipId: minor.membershipId,
      dateOfBirth: "2015-05-10",
      guardianRequired: true,
      nativeLanguage: "en",
      targetLanguage: "es",
      currentLevel: "B1",
      status: "active",
    })
    .returning({ id: schema.studentProfiles.id });
  if (!teacherProfile || !adultProfile || !minorProfile) {
    throw new Error("No se pudieron crear perfiles E2E.");
  }
  teacher.profileId = teacherProfile.id;
  adult.profileId = adultProfile.id;
  minor.profileId = minorProfile.id;

  await db.insert(schema.guardians).values({
    schoolId: school.id,
    studentProfileId: minorProfile.id,
    membershipId: guardian.membershipId,
    relationship: "mother",
    canGiveConsent: true,
  });

  const [course] = await db
    .insert(schema.courses)
    .values({
      schoolId: school.id,
      code: `B1-${RUN}-${suffix}`,
      language: "es",
      level: "B1",
      modality: "group",
      totalSessions: 40,
      sessionMinutes: 60,
      maxStudents: 8,
      priceCents: 9000,
      currency: "EUR",
      isActive: true,
    })
    .returning({ id: schema.courses.id });
  if (!course) throw new Error("No se pudo crear curso E2E.");
  await db.insert(schema.courseTranslations).values({
    schoolId: school.id,
    courseId: course.id,
    locale: "es-ES",
    name: `Español B1 Ola 3 ${suffix}`,
  });
  const [group] = await db
    .insert(schema.groups)
    .values({
      schoolId: school.id,
      courseId: course.id,
      teacherProfileId: teacherProfile.id,
      name: `B1 tarde Ola 3 ${suffix}`,
      capacity: 8,
      startsOn: "2026-07-01",
      status: "running",
    })
    .returning({ id: schema.groups.id });
  if (!group) throw new Error("No se pudo crear grupo E2E.");
  await db.insert(schema.enrollments).values([
    { schoolId: school.id, groupId: group.id, studentProfileId: adultProfile.id, status: "active" },
    { schoolId: school.id, groupId: group.id, studentProfileId: minorProfile.id, status: "active" },
  ]);

  const [postSessionSurvey] = await db
    .insert(schema.surveys)
    .values({
      schoolId: school.id,
      kind: "post_session",
      code: `post-session-${suffix}`,
      name: "Encuesta post-clase",
      audience: "student",
      autoSendAfterSession: true,
      isActive: true,
    })
    .returning({ id: schema.surveys.id });
  const [npsSurvey] = await db
    .insert(schema.surveys)
    .values({
      schoolId: school.id,
      kind: "nps",
      code: `nps-${suffix}`,
      name: "NPS trimestral",
      audience: "student",
      autoSendAfterSession: false,
      isActive: true,
    })
    .returning({ id: schema.surveys.id });
  if (!postSessionSurvey || !npsSurvey) throw new Error("No se pudieron crear encuestas E2E.");

  const readySessionId = await createCompletedSession(db, {
    schoolId: school.id,
    groupId: group.id,
    teacherProfileId: teacherProfile.id,
    topic: "Debate con consentimiento",
    start: "2026-07-27T09:00:00.000Z",
  });
  const blockedSessionId = await createCompletedSession(db, {
    schoolId: school.id,
    groupId: group.id,
    teacherProfileId: teacherProfile.id,
    topic: "Debate sin consentimiento del menor",
    start: "2026-07-27T11:00:00.000Z",
  });
  const absentSessionIds = [];
  for (const [index, start] of [
    "2026-07-27T12:00:00.000Z",
    "2026-07-27T13:00:00.000Z",
    "2026-07-27T14:00:00.000Z",
  ].entries()) {
    absentSessionIds.push(
      await createCompletedSession(db, {
        schoolId: school.id,
        groupId: group.id,
        teacherProfileId: teacherProfile.id,
        topic: `Falta consecutiva ${index + 1}`,
        start,
      }),
    );
  }

  await db.insert(schema.attendance).values([
    {
      schoolId: school.id,
      sessionId: readySessionId,
      studentProfileId: adultProfile.id,
      status: "present",
      source: "manual",
      joinedAt: new Date("2026-07-27T09:00:00.000Z"),
      leftAt: new Date("2026-07-27T10:00:00.000Z"),
      minutesPresent: 60,
      recordedByMembershipId: teacher.membershipId,
    },
    {
      schoolId: school.id,
      sessionId: readySessionId,
      studentProfileId: minorProfile.id,
      status: "present",
      source: "manual",
      joinedAt: new Date("2026-07-27T09:00:00.000Z"),
      leftAt: new Date("2026-07-27T10:00:00.000Z"),
      minutesPresent: 60,
      recordedByMembershipId: teacher.membershipId,
    },
    ...absentSessionIds.map((sessionId) => ({
      schoolId: school.id,
      sessionId,
      studentProfileId: adultProfile.id,
      status: "absent" as const,
      source: "manual" as const,
      recordedByMembershipId: teacher.membershipId,
    })),
  ]);

  await db.insert(schema.consents).values([
    {
      schoolId: school.id,
      subjectMembershipId: teacher.membershipId,
      kind: "recording",
      status: "granted",
      grantedByMembershipId: teacher.membershipId,
      grantedAt: NOW,
      policyVersion: "1.0",
      evidence: "e2e",
    },
    {
      schoolId: school.id,
      subjectMembershipId: adult.membershipId,
      kind: "recording",
      status: "granted",
      grantedByMembershipId: adult.membershipId,
      grantedAt: NOW,
      policyVersion: "1.0",
      evidence: "e2e",
    },
    {
      schoolId: school.id,
      subjectMembershipId: minor.membershipId,
      kind: "recording",
      status: "granted",
      grantedByMembershipId: guardian.membershipId,
      grantedAt: NOW,
      policyVersion: "1.0",
      evidence: "e2e",
    },
  ]);

  return {
    schoolId: school.id,
    owner,
    teacher,
    adult,
    minor,
    guardian,
    courseId: course.id,
    groupId: group.id,
    postSessionSurveyId: postSessionSurvey.id,
    npsSurveyId: npsSurvey.id,
    readySessionId,
    blockedSessionId,
    absentSessionIds,
  };
}

async function createCompletedSession(
  db: Db,
  params: {
    schoolId: string;
    groupId: string;
    teacherProfileId: string;
    topic: string;
    start: string;
  },
): Promise<string> {
  const start = new Date(params.start);
  const end = new Date(start.getTime() + 60 * 60_000);
  const [session] = await db
    .insert(schema.sessions)
    .values({
      schoolId: params.schoolId,
      groupId: params.groupId,
      teacherProfileId: params.teacherProfileId,
      scheduledStart: start,
      scheduledEnd: end,
      actualStart: start,
      actualEnd: end,
      status: "completed",
      topic: params.topic,
      roomProvider: "livekit",
      roomUrl: `https://aula.langopia.test/${RUN}`,
    })
    .returning({ id: schema.sessions.id });
  if (!session) throw new Error("No se pudo crear sesión E2E.");
  return session.id;
}

async function signIn(baseUrl: string, email: string, password: string): Promise<string> {
  const response = await call(baseUrl, "POST", "/auth/sign-in/email", {
    body: { email, password },
  });
  expect(response.status).toBe(200);
  if (!response.cookie) throw new Error(`No se recibió cookie para ${email}.`);
  return response.cookie;
}

async function runAsTenant<T>(
  cls: ClsService,
  context: { schoolId: string; membershipId: string; roles: string[] },
  work: () => Promise<T>,
): Promise<T> {
  return cls.runWith(
    {
      [CLS_SCHOOL_ID]: context.schoolId,
      [CLS_MEMBERSHIP_ID]: context.membershipId,
      [CLS_ROLES]: context.roles,
    },
    work,
  ) as Promise<T>;
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function authorizeMcpClient(params: {
  baseUrl: string;
  ownerCookie: string;
  scopes: string[];
}): Promise<{ accessToken: string; authorizationId: string }> {
  const redirectUri = "https://claude.ai/api/mcp/auth_callback";
  const registered = await call(params.baseUrl, "POST", "/mcp/oauth/register", {
    body: {
      client_name: `Claude E2E Ola 3 ${RUN}`,
      redirect_uris: [redirectUri],
      scope: params.scopes.join(" "),
    },
  });
  expect(registered.status).toBe(201);
  const clientId = registered.body.client_id as string;
  const verifier = `verifier-${RUN}-${randomUUID()}`;
  const state = `state-${RUN}`;
  const authorize = await call(
    params.baseUrl,
    "GET",
    `/mcp/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: "S256",
      scope: params.scopes.join(" "),
      state,
      consent: "accept",
    })}`,
    { cookie: params.ownerCookie },
  );
  expect(authorize.status).toBe(302);
  const location = authorize.headers.get("location");
  if (!location) throw new Error("OAuth MCP no devolvió redirect con código.");
  const code = new URL(location).searchParams.get("code");
  expect(new URL(location).searchParams.get("state")).toBe(state);
  if (!code) throw new Error("OAuth MCP no devolvió code.");

  const token = await call(params.baseUrl, "POST", "/mcp/oauth/token", {
    body: {
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    },
  });
  expect(token.status).toBe(201);
  const accessToken = token.body.access_token as string;
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1]!, "base64url").toString("utf8")) as {
    authorizationId: string;
  };
  return { accessToken, authorizationId: payload.authorizationId };
}

async function mcpCall(
  baseUrl: string,
  accessToken: string,
  name: string,
  args: Json = {},
): Promise<{ status: number; body: Json }> {
  const response = await call(baseUrl, "POST", "/mcp", {
    authorization: `Bearer ${accessToken}`,
    body: {
      jsonrpc: "2.0",
      id: name,
      method: "tools/call",
      params: { name, arguments: args },
    },
  });
  return { status: response.status, body: response.body };
}

async function markTranscriptReady(
  db: Db,
  params: {
    schoolId: string;
    transcriptId: string;
    teacherMembershipId: string;
    studentMembershipId: string;
  },
): Promise<void> {
  await db
    .update(schema.transcripts)
    .set({
      status: "ready",
      durationMs: 3_600_000,
      summary: "Clase sobre objeciones comerciales y seguimiento de alumnos.",
      vocabulary: [{ term: "seguimiento", lemma: "seguimiento", level: "B1", count: 2 }],
      retentionUntil: new Date("2026-10-26T10:00:00.000Z"),
      readyAt: NOW,
    })
    .where(eq(schema.transcripts.id, params.transcriptId));
  await db.insert(schema.transcriptSegments).values({
    schoolId: params.schoolId,
    transcriptId: params.transcriptId,
    startMs: 0,
    endMs: 8_000,
    speakerMembershipId: params.teacherMembershipId,
    speakerLabel: "Profesora",
    text: "Hoy vamos a revisar cómo pedir una aclaración con educación.",
    confidence: 9700,
    isTeacher: true,
  });
  await db.insert(schema.transcriptSegments).values({
    schoolId: params.schoolId,
    transcriptId: params.transcriptId,
    startMs: 8_000,
    endMs: 15_000,
    speakerMembershipId: params.studentMembershipId,
    speakerLabel: "Alumno",
    text: "Podría repetir la última frase, por favor?",
    confidence: 9600,
    isTeacher: false,
  });
}

describe("Ola 3 — recorrido completo de analítica, transcripciones y MCP (Tarea 11)", () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminDb: Db;
  let closeAdminDb: () => Promise<void>;
  let transcription: FakeTranscriptionProvider;
  let commandBus: CommandBus;
  let cls: ClsService;
  let consentWithdrawnHandler: OnConsentWithdrawnDeleteTranscripts;

  beforeAll(async () => {
    transcription = new FakeTranscriptionProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(NOW))
      .overrideProvider(TRANSCRIPTION_PORT)
      .useValue(transcription)
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

    commandBus = app.get(CommandBus);
    cls = app.get(ClsService);
    consentWithdrawnHandler = app.get(OnConsentWithdrawnDeleteTranscripts);
    const admin = createAdminDb();
    adminDb = admin.db;
    closeAdminDb = () => admin.client.end({ timeout: 5 });
  });

  afterAll(async () => {
    await app?.close();
    await closeAdminDb?.();
  });

  it("cierra la ola con encuestas, riesgo, transcripción, aislamiento MCP, revocación y auditoría", async () => {
    const schoolA = await createSchoolFixture(adminDb, "a");
    const schoolB = await createSchoolFixture(adminDb, "b");

    const ownerCookie = await signIn(baseUrl, `duena-a@${EMAIL_DOMAIN}`, OWNER_PASSWORD);
    const studentCookie = await signIn(baseUrl, `alumno-a@${EMAIL_DOMAIN}`, "Alumno-ola3-a-2026!");

    const postSession = await call(
      baseUrl,
      "POST",
      `/feedback/surveys/${schoolA.postSessionSurveyId}/responses`,
      {
        cookie: studentCookie,
        body: {
          score: 5,
          comment: "La clase fue clara y accionable.",
          sessionId: schoolA.readySessionId,
          teacherProfileId: schoolA.teacher.profileId,
        },
      },
    );
    expect(postSession.status).toBe(201);

    const npsResponse = await call(
      baseUrl,
      "POST",
      `/feedback/surveys/${schoolA.npsSurveyId}/responses`,
      {
        cookie: studentCookie,
        body: { score: 6, comment: "Necesito más seguimiento." },
      },
    );
    expect(npsResponse.status).toBe(201);

    const from = "2026-07-01";
    const to = "2026-08-01";
    const nps = await call(baseUrl, "GET", `/feedback/nps?from=${from}&to=${to}`, {
      cookie: ownerCookie,
    });
    expect(nps.status).toBe(200);
    expect(nps.body).toMatchObject({ score: -100, respondents: 1, promoters: 0, passives: 0, detractors: 1 });

    const risk = await call(baseUrl, "GET", "/feedback/students-at-risk", { cookie: ownerCookie });
    expect(risk.status).toBe(200);
    const riskyStudent = (risk.body as Array<Json>).find((student) => student.studentId === schoolA.adult.profileId);
    if (!riskyStudent) throw new Error("El alumno en riesgo de la escuela A no apareció.");
    expect(riskyStudent).toMatchObject({ name: "Alumno en riesgo Ola 3", level: "high" });
    expect(riskyStudent.reasons.map((reason: Json) => reason.signal)).toEqual(
      expect.arrayContaining(["low_attendance", "consecutive_absences", "no_recent_evaluation", "detractor_nps"]),
    );

    const processing = await runAsTenant(
      cls,
      { schoolId: schoolA.schoolId, membershipId: schoolA.owner.membershipId, roles: ["owner"] },
      () =>
        commandBus.execute(
          new StartTranscriptionCommand({
            sessionId: schoolA.readySessionId,
            language: "es",
          }),
        ),
    );
    expect(processing.status).toBe("processing");
    expect(transcription.starts).toHaveLength(1);
    expect(transcription.starts[0]).toMatchObject({
      sessionId: schoolA.readySessionId,
      language: "es",
    });
    await markTranscriptReady(adminDb, {
      schoolId: schoolA.schoolId,
      transcriptId: processing.transcriptId,
      teacherMembershipId: schoolA.teacher.membershipId,
      studentMembershipId: schoolA.adult.membershipId,
    });

    const transcriptsReady = await call(baseUrl, "GET", "/classroom/transcripts", { cookie: ownerCookie });
    expect(transcriptsReady.status).toBe(200);
    expect((transcriptsReady.body as Array<Json>).find((t) => t.transcriptId === processing.transcriptId)).toMatchObject({
      status: "ready",
      summary: "Clase sobre objeciones comerciales y seguimiento de alumnos.",
      segments: expect.arrayContaining([
        expect.objectContaining({ speakerLabel: "Profesora" }),
        expect.objectContaining({ speakerLabel: "Alumno" }),
      ]),
    });

    await adminDb
      .update(schema.consents)
      .set({ status: "withdrawn", withdrawnAt: NOW })
      .where(eq(schema.consents.subjectMembershipId, schoolA.minor.membershipId));
    const blocked = await runAsTenant(
      cls,
      { schoolId: schoolA.schoolId, membershipId: schoolA.owner.membershipId, roles: ["owner"] },
      () =>
        commandBus.execute(
          new StartTranscriptionCommand({
            sessionId: schoolA.blockedSessionId,
            language: "es",
          }),
        ),
    );
    expect(blocked.status).toBe("blocked_no_consent");
    expect(transcription.starts).toHaveLength(1);
    const transcriptsWithBlock = await call(baseUrl, "GET", "/classroom/transcripts", { cookie: ownerCookie });
    const blockedView = (transcriptsWithBlock.body as Array<Json>).find((t) => t.transcriptId === blocked.transcriptId);
    if (!blockedView) throw new Error("La transcripción bloqueada no apareció en el read-model.");
    expect(blockedView).toMatchObject({ status: "blocked_no_consent" });
    expect(blockedView.blockedReason).toContain("Menor Ola 3 a");

    await runAsTenant(
      cls,
      { schoolId: schoolA.schoolId, membershipId: schoolA.owner.membershipId, roles: ["owner"] },
      async () => {
        await adminDb
          .update(schema.consents)
          .set({ status: "withdrawn", withdrawnAt: NOW })
          .where(eq(schema.consents.subjectMembershipId, schoolA.adult.membershipId));
        await consentWithdrawnHandler.handle(
          new ConsentWithdrawn({
            studentId: schoolA.adult.profileId!,
            schoolId: schoolA.schoolId,
            kind: "recording",
            subjectMembershipId: schoolA.adult.membershipId,
          }),
        );
      },
    );
    const removed = await adminDb.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count
      FROM transcripts
      WHERE id = ${processing.transcriptId}
    `);
    expect(Number(removed[0]?.count)).toBe(0);

    const oauth = await authorizeMcpClient({
      baseUrl,
      ownerCookie,
      scopes: ["students:read", "analytics:read"],
    });
    const studentsViaMcp = await mcpCall(baseUrl, oauth.accessToken, "buscar_alumnos", {
      schoolId: schoolB.schoolId,
    });
    expect(studentsViaMcp.status).toBe(200);
    const mcpStudentNames = (studentsViaMcp.body.result.structuredContent as Array<Json>).map((student) => student.name);
    expect(mcpStudentNames).toContain("Alumno en riesgo Ola 3");
    expect(mcpStudentNames).not.toContain("Alumno otra escuela Ola 3");

    const riskViaMcp = await mcpCall(baseUrl, oauth.accessToken, "alumnos_en_riesgo");
    expect(riskViaMcp.status).toBe(200);
    expect((riskViaMcp.body.result.structuredContent as Array<Json>).find((student) => student.studentId === schoolA.adult.profileId)).toMatchObject({
      level: "high",
      reasons: expect.arrayContaining([
        expect.objectContaining({ signal: "no_recent_evaluation" }),
      ]),
    });

    const auditRows = await adminDb.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count
      FROM audit_logs
      WHERE school_id = ${schoolA.schoolId}
        AND actor_kind = 'mcp'
        AND mcp_client_id IS NOT NULL
        AND action = 'mcp.tool.executed'
    `);
    expect(Number(auditRows[0]?.count)).toBeGreaterThanOrEqual(2);

    const revoked = await call(
      baseUrl,
      "POST",
      `/mcp/oauth/authorizations/${oauth.authorizationId}/revoke`,
      { cookie: ownerCookie },
    );
    expect(revoked.status).toBe(201);
    const afterRevoke = await mcpCall(baseUrl, oauth.accessToken, "buscar_alumnos");
    expect(afterRevoke.status).toBe(403);
    expect(afterRevoke.body.code).toBe("mcp_token_revoked");
  });
});
