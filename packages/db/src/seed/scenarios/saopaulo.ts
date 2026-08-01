/**
 * Escenario 3 — Idiomas Paulista (pt-BR)
 *
 * La escuela grande: plan Escala, dominio propio, MCP activo, transcripción
 * encendida y comisión de plataforma puesta a cero por negociación. Es el
 * caso que demuestra que la comisión es configurable por escuela y no una
 * constante del producto.
 *
 * Su otra función es probar el aislamiento entre tenants: Dan Whitfield da
 * clase aquí Y en la Escuela Atlántico. Es el mismo `users.id`, con dos
 * `memberships` distintas. Ninguna consulta hecha en el contexto de una
 * escuela puede devolver datos de la otra.
 *
 * Casos que cubre:
 *   · comisión de plataforma configurada a 0 % con la casilla activada
 *   · profesor compartido entre dos escuelas (aislamiento)
 *   · dominio propio verificado y sitio público
 *   · cliente MCP de ChatGPT en uso
 *   · escuela con la suscripción impagada (`past_due`)
 *   · moneda distinta del euro y zona horaria americana
 *   · alumnado corporativo facturado a la empresa
 */
import type { Db } from "../../index.js";
import { SchoolBuilder } from "../builders.js";
import {
  birthDateForAge,
  daysAgo,
  euros,
  NOW,
  pick,
  randomInt,
  weekSlot,
  weeksAgo,
} from "../helpers.js";
import { EN_B2_BUSINESS_EXERCISES } from "../reference.js";

export async function seedSaoPaulo(
  db: Db,
  planIds: Map<string, string>,
  sharedTeacherUserId: string,
) {
  const b = new SchoolBuilder(db, {
    slug: "paulista",
    name: "Idiomas Paulista",
    legalName: "Paulista Idiomas Ltda.",
    taxId: "12.345.678/0001-95",
    country: "BR",
    defaultLocale: "pt-BR",
    supportedLocales: ["pt-BR", "en-GB", "es-ES"],
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    status: "past_due", // debe la suscripción de este mes
    planCode: "scale",
    merchantStatus: "active",
    // Comisión activada pero puesta a 0: acuerdo comercial con esta escuela.
    applicationFeeEnabled: true,
    applicationFeeBps: 0,
    aiCreditsBalance: 0,
    videoBetaEnabled: false,
    dataRetentionDays: 365,
    emailDomain: "paulista.example",
    branding: { primaryColor: "#0F3D2E", accentColor: "#C9752A" },
  });

  await b.create(planIds.get("scale")!);
  await b.addDomain("paulista.langopia.app", false, true);
  await b.addDomain("idiomaspaulista.com.br", true, true); // dominio propio

  /* ── Personal ────────────────────────────────────────────────────────── */

  const renata = await b.person({
    name: "Renata Vasconcelos",
    role: "owner",
    locale: "pt-BR",
    authProvider: "google",
  });
  const paulo = await b.person({ name: "Paulo Andrade", role: "admin", locale: "pt-BR" });

  // MISMO USUARIO que en la Escuela Atlántico. Dos membresías, dos escuelas.
  const dan = await b.teacher({
    name: "Dan Whitfield",
    tier: "professional",
    languages: ["en"],
    hourlyRateCents: euros(38),
    contractedHoursWeek: 12,
    hiredAt: weeksAgo(30),
    isNativeSpeaker: true,
    reuseUserId: sharedTeacherUserId,
    locale: "en-GB",
  });

  const beatriz = await b.teacher({
    name: "Beatriz Nunes",
    tier: "specialist",
    languages: ["en", "pt"],
    hourlyRateCents: euros(60),
    contractedHoursWeek: 20,
    hiredAt: weeksAgo(60),
    certifications: ["TOEFL iBT examiner", "Business English Certificate"],
    locale: "pt-BR",
  });

  await b.availability(dan.profile.id, [
    { weekday: 2, from: 8, to: 12 },
    { weekday: 4, from: 8, to: 12 },
  ]);
  await b.availability(beatriz.profile.id, [
    { weekday: 1, from: 8, to: 13 },
    { weekday: 3, from: 8, to: 13 },
    { weekday: 5, from: 8, to: 13 },
  ]);

  /* ── Cursos ──────────────────────────────────────────────────────────── */

  const corpEn = await b.course({
    code: "EN-B2-CORP",
    language: "en",
    level: "B2",
    modality: "business",
    priceCents: euros(1180),
    maxStudents: 8,
    translations: [
      { locale: "pt-BR", name: "Inglês corporativo B2", description: "Turmas in-company para equipes." },
      { locale: "en-GB", name: "Corporate English B2" },
    ],
  });

  const toeflPrep = await b.course({
    code: "EN-C1-TOEFL",
    language: "en",
    level: "C1",
    modality: "exam_prep",
    priceCents: euros(1490),
    translations: [
      { locale: "pt-BR", name: "Preparatório TOEFL" },
      { locale: "en-GB", name: "TOEFL preparation" },
    ],
  });

  const gCorp = await b.group({
    courseId: corpEn.id,
    teacherProfileId: beatriz.profile.id,
    name: "In-company Vertex — ter & qui 08:00",
    capacity: 8,
    startsOn: weeksAgo(16),
    status: "running",
  });
  const gToefl = await b.group({
    courseId: toeflPrep.id,
    teacherProfileId: dan.profile.id,
    name: "TOEFL — turma de inverno",
    startsOn: weeksAgo(8),
    status: "running",
  });

  /* ── Alumnado ────────────────────────────────────────────────────────── */

  const names = [
    "Ana Beatriz Lima", "Carlos Eduardo Reis", "Daniela Prado", "Eduardo Tavares",
    "Fernanda Cardoso", "Gustavo Mendes", "Helena Barros", "Igor Salgado",
    "Juliana Freitas", "Leonardo Pinto", "Marina Rocha", "Nelson Duarte",
  ];

  const students = [];
  for (const [i, name] of names.entries()) {
    const student = await b.student({
      name,
      dateOfBirth: birthDateForAge(randomInt(23, 48)),
      nativeLanguage: "pt",
      targetLanguage: "en",
      currentLevel: i < 8 ? "B2" : "C1",
      targetLevel: i < 8 ? "C1" : "C2",
      joinedAt: weeksAgo(randomInt(4, 16)),
      locale: "pt-BR",
    });
    await b.consent({
      subjectMembershipId: student.membership.id,
      kind: "data_processing",
      status: "granted",
      grantedByMembershipId: student.membership.id,
    });
    await b.consent({
      subjectMembershipId: student.membership.id,
      kind: "recording",
      status: "granted",
      grantedByMembershipId: student.membership.id,
    });
    await b.consent({
      subjectMembershipId: student.membership.id,
      kind: "ai_processing",
      status: "granted",
      grantedByMembershipId: student.membership.id,
    });
    await b.enroll({
      groupId: i < 8 ? gCorp.id : gToefl.id,
      studentProfileId: student.profile.id,
      enrolledAt: weeksAgo(randomInt(4, 16)),
    });
    students.push(student);
  }

  /* ── Contenido ───────────────────────────────────────────────────────── */

  const rubrics = await b.rubrics();
  await b.grantCredits({
    credits: 2000,
    reason: "plan_grant",
    note: "Créditos incluidos en el plan Escala",
    createdAt: weeksAgo(4),
  });

  const unit = await b.unit({
    courseId: corpEn.id,
    code: "EN-B2-CORP-U09",
    language: "en",
    level: "B2",
    topic: "Negotiating a deadline",
    skills: ["reading", "writing", "vocabulary"],
    source: "ai_generated",
    status: "published",
    primaryLocale: "en-GB",
    translations: [
      { locale: "en-GB", title: "Negotiating a deadline", description: "Pushing back on dates without losing the account." },
      { locale: "pt-BR", title: "Negociando um prazo", machineTranslated: true },
    ],
    exercises: EN_B2_BUSINESS_EXERCISES,
    rubricIds: { escrita: rubrics.escrita.id, oral: rubrics.oral.id },
    createdByMembershipId: beatriz.membership.id,
    reviewedByMembershipId: beatriz.membership.id,
    reviewedAt: weeksAgo(2),
    publishedAt: weeksAgo(2),
    createdAt: weeksAgo(2),
    generationCostCents: 232,
    creditsSpent: 23,
    assets: [{ kind: "audio", provider: "tts", durationMs: 165_000 }],
  });

  await b.aiGeneration({
    kind: "exercise_set",
    status: "succeeded",
    provider: "anthropic",
    model: "claude-opus-5",
    inputTokens: 5_600,
    outputTokens: 4_200,
    costCents: 78,
    creditsCharged: 8,
    contentUnitId: unit.unit.id,
    requestedByMembershipId: beatriz.membership.id,
    createdAt: weeksAgo(2),
  });
  // Generación lanzada desde ChatGPT vía MCP.
  await b.aiGeneration({
    kind: "placement_test",
    status: "succeeded",
    provider: "anthropic",
    model: "claude-opus-5",
    inputTokens: 2_100,
    outputTokens: 3_400,
    costCents: 46,
    creditsCharged: 5,
    requestedByMembershipId: renata.membership.id,
    origin: "mcp",
    createdAt: daysAgo(2),
  });

  /* ── Clases y transcripciones ────────────────────────────────────────── */

  for (let week = 4; week >= 0; week--) {
    for (const weekday of [2, 4]) {
      const start = weekSlot(-week, weekday, 8);
      const isPast = start < NOW;
      const session = await b.session({
        groupId: gCorp.id,
        teacherProfileId: beatriz.profile.id,
        start,
        minutes: 60,
        status: isPast ? "completed" : "scheduled",
        roomProvider: "ms_teams", // la empresa cliente trabaja en Teams
        topic: "Negotiating a deadline",
        contentUnitId: unit.unit.id,
      });
      if (!isPast) continue;

      for (const student of students.slice(0, 8)) {
        await b.attend({
          sessionId: session.id,
          studentProfileId: student.profile.id,
          status: pick(["present", "present", "present", "late", "absent"] as const),
          source: "imported", // del informe de asistencia de Teams
          sessionStart: start,
        });
      }

      if (week === 1 && weekday === 2) {
        await b.transcript({
          sessionId: session.id,
          status: "ready",
          provider: "ms_teams",
          language: "en",
          durationMs: 3_600_000,
          summary:
            "Role-play on pushing a delivery date. Recurring error: 'I will send you until Friday' instead of 'by Friday'.",
          vocabulary: [
            { term: "deadline", level: "B1", count: 14 },
            { term: "to push back", level: "B2", count: 6 },
            { term: "contingency", level: "C1", count: 3 },
          ],
          createdAt: start,
        });
      }
    }
  }

  for (let week = 3; week >= 0; week--) {
    const start = weekSlot(-week, 3, 19);
    const isPast = start < NOW;
    const session = await b.session({
      groupId: gToefl.id,
      teacherProfileId: dan.profile.id,
      start,
      minutes: 90,
      status: isPast ? "completed" : "scheduled",
      roomProvider: "livekit",
      topic: "TOEFL integrated writing",
    });
    if (!isPast) continue;
    for (const student of students.slice(8)) {
      await b.attend({
        sessionId: session.id,
        studentProfileId: student.profile.id,
        status: "present",
        source: "auto",
        sessionStart: start,
        minutes: 90,
      });
    }
  }

  /* ── Facturación con comisión al 0 % ─────────────────────────────────── */
  //
  // La casilla está activada, pero los puntos básicos son 0. Las facturas
  // salen con `applicationFeeCents = 0`, y así queda registrado: si mañana
  // se sube la comisión, el histórico no cambia.

  for (const student of students.slice(0, 8)) {
    await b.studentInvoice({
      studentProfileId: student.profile.id,
      billToMembershipId: student.membership.id,
      locale: "pt-BR",
      lines: [{ description: "Inglês corporativo B2 — mensalidade de julho", quantity: 1, unitCents: euros(295), courseId: corpEn.id }],
      taxRateBps: 0,
      status: "paid",
      issuedOn: daysAgo(22),
      dueOn: daysAgo(15),
      paidAt: daysAgo(19),
      paymentStatus: "succeeded",
      paymentMethod: "bank_transfer",
    });
  }
  for (const student of students.slice(8)) {
    await b.studentInvoice({
      studentProfileId: student.profile.id,
      billToMembershipId: student.membership.id,
      locale: "pt-BR",
      lines: [{ description: "Preparatório TOEFL — mensalidade de julho", quantity: 1, unitCents: euros(372), courseId: toeflPrep.id }],
      taxRateBps: 0,
      status: "paid",
      issuedOn: daysAgo(22),
      dueOn: daysAgo(15),
      paidAt: daysAgo(18),
      paymentStatus: "succeeded",
    });
  }

  // Tu factura a la escuela, impagada: por eso el estado es `past_due`.
  await b.platformInvoice({
    planName: "Escala",
    priceCents: euros(349),
    status: "past_due",
    issuedOn: daysAgo(21),
  });

  /* ── Satisfacción ────────────────────────────────────────────────────── */

  const nps = await b.survey({
    kind: "nps",
    code: "nps-semestral",
    name: "NPS semestral",
    audience: "student",
  });
  for (const student of students) {
    await b.surveyResponse({
      surveyId: nps.id,
      respondentMembershipId: student.membership.id,
      respondentKind: "student",
      score: pick([10, 9, 9, 9, 8, 8, 7, 10, 6]),
      submittedAt: weeksAgo(randomInt(1, 6)),
    });
  }

  await b.evaluation({
    teacherProfileId: beatriz.profile.id,
    studentProfileId: students[0]!.profile.id,
    periodStart: weeksAgo(8),
    periodEnd: daysAgo(2),
    progressRating: 4,
    levelAtEvaluation: "B2",
    strengths: "Vocabulário técnico muito sólido para reuniões.",
    improvements: "Uso de preposições de tempo em prazos.",
    nextSteps: "Focar em 'by' vs 'until' nas próximas duas unidades.",
    createdAt: daysAgo(2),
  });

  /* ── MCP ─────────────────────────────────────────────────────────────── */

  await b.mcpClient({
    name: "ChatGPT — coordenação pedagógica",
    clientKind: "chatgpt",
    scopes: ["students:read", "sessions:read", "content:write", "analytics:read"],
    authorizedByMembershipId: renata.membership.id,
    lastUsedAt: daysAgo(2),
  });
  await b.mcpClient({
    name: "Claude — diretoria",
    clientKind: "claude",
    scopes: ["analytics:read", "billing:read"],
    authorizedByMembershipId: renata.membership.id,
    lastUsedAt: daysAgo(6),
  });

  /* ── Auditoría ───────────────────────────────────────────────────────── */

  await b.audit({
    action: "school.application_fee_changed",
    entityType: "school",
    entityId: b.id,
    actorKind: "system",
    after: { applicationFeeBps: 0, note: "Acuerdo comercial: comisión 0 % durante el primer año" },
    createdAt: weeksAgo(20),
  });
  await b.audit({
    action: "domain.verified",
    entityType: "school_domain",
    actorMembershipId: paulo.membership.id,
    after: { hostname: "idiomaspaulista.com.br" },
    createdAt: weeksAgo(18),
  });
  await b.audit({
    action: "subscription.payment_failed",
    entityType: "subscription",
    actorKind: "webhook",
    after: { attempt: 2, nextRetryInDays: 3 },
    createdAt: daysAgo(7),
  });
  await b.audit({
    action: "content.generate",
    entityType: "content_unit",
    actorKind: "mcp",
    actorMembershipId: renata.membership.id,
    after: { kind: "placement_test", origin: "chatgpt" },
    createdAt: daysAgo(2),
  });

  return { school: b.school, owner: renata, teachers: { dan, beatriz }, students };
}
