/**
 * Escenario 1 — Escuela Atlántico (es-ES)
 *
 * La escuela «completa»: plan Crecimiento, Stripe Connect activo, comisión del
 * 2 % habilitada, contenido generado con IA y todos los casos borde que el
 * producto tiene que saber enseñar. Es la que reproduce el panel de dirección
 * del documento de diseño.
 *
 * Casos que cubre, en orden de aparición:
 *   · alumno en riesgo de baja por asistencia        · alumno menor con tutor
 *   · alumno sin valorar desde hace semanas          · alumno con reseña negativa
 *   · alumno listo para subir de nivel               · alumno de baja y alumno pausado
 *   · profesor con sobrecarga y profesor infrautilizado
 *   · profesor que se fue     · profesor que trabaja también en otra escuela
 *   · clase completada, cancelada por el alumno, cancelada por la escuela,
 *     replanificada, futura y sin asistentes
 *   · aula propia, Zoom, Meet y Teams
 *   · unidad publicada, unidad en revisión, unidad subida y vídeo en beta
 *   · los once tipos de ejercicio         · corrección de IA validada y sin validar
 *   · factura pagada, vencida, fallida, con devolución parcial y total
 *   · transcripción lista, importada y bloqueada por falta de consentimiento
 *   · cliente MCP activo y cliente MCP revocado
 */
import type { Db } from "../../index.js";
import { eq } from "drizzle-orm";
import * as s from "../../schema/index.js";
import { SchoolBuilder } from "../builders.js";
import {
  birthDateForAge,
  chance,
  daysAgo,
  daysFromNow,
  euros,
  isoDate,
  minutesAfter,
  NOW,
  pick,
  randomInt,
  weekSlot,
  weeksAgo,
} from "../helpers.js";
import { ES_B1_DOCTOR_EXERCISES, EN_B2_BUSINESS_EXERCISES } from "../reference.js";
import {
  seedAnalyticsHistory,
  seedLeads,
  seedMcpAuthorizations,
  seedPlacementBank,
  seedSite,
} from "../growth.js";

const FILLER_STUDENTS = 40;

export async function seedAtlantico(db: Db, planIds: Map<string, string>) {
  const b = new SchoolBuilder(db, {
    slug: "atlantico",
    name: "Escuela Atlántico",
    legalName: "Idiomas Atlántico S.L.",
    taxId: "B12345678",
    country: "ES",
    defaultLocale: "es-ES",
    supportedLocales: ["es-ES", "en-GB", "gl-ES"],
    timezone: "Europe/Madrid",
    currency: "EUR",
    status: "active",
    planCode: "growth",
    merchantStatus: "active",
    applicationFeeEnabled: true,
    applicationFeeBps: 200, // 2 %
    applicationFeeCapCents: null,
    aiCreditsBalance: 0,
    videoBetaEnabled: true,
    dataRetentionDays: 180,
    emailDomain: "atlantico.example",
    branding: { primaryColor: "#13314B", accentColor: "#2B47C4" },
  });

  await b.create(planIds.get("growth")!);
  await b.addDomain("atlantico.langopia.app", true, true);

  /* ── Dirección y administración ──────────────────────────────────────── */

  const marta = await b.person({
    name: "Marta Colomer",
    role: "owner",
    authProvider: "google",
  });
  const ruben = await b.person({
    name: "Rubén Ariza",
    role: "admin",
    authProvider: "microsoft",
  });

  /* ── Profesorado ─────────────────────────────────────────────────────── */
  // Las tarifas siguen los tramos reales de italki y Preply (julio 2026).

  const carla = await b.teacher({
    name: "Carla Ruiz",
    tier: "professional",
    languages: ["es"],
    hourlyRateCents: euros(28),
    contractedHoursWeek: 24,
    hiredAt: weeksAgo(96),
    isNativeSpeaker: true,
    certifications: ["ELE Instituto Cervantes"],
    bio: "Profesora de español con nueve años de experiencia en preparación de DELE.",
  });

  // Da clase también en São Paulo: mismo usuario, dos escuelas. Es el caso que
  // demuestra que la identidad es global y el acceso está aislado por tenant.
  const dan = await b.teacher({
    name: "Dan Whitfield",
    tier: "professional",
    languages: ["en"],
    hourlyRateCents: euros(32),
    contractedHoursWeek: 24,
    hiredAt: weeksAgo(70),
    isNativeSpeaker: true,
    certifications: ["CELTA", "DELTA"],
    email: "dan.whitfield@langopia-teachers.example",
    locale: "en-GB",
  });

  const sofia = await b.teacher({
    name: "Sofia Mancini",
    tier: "specialist",
    languages: ["en", "it"],
    hourlyRateCents: euros(55), // tramo de especialista: business y examen
    contractedHoursWeek: 24,
    hiredAt: weeksAgo(52),
    certifications: ["Business English Certificate", "TOEIC examiner"],
  });

  const yuki = await b.teacher({
    name: "Yuki Tanaka",
    tier: "community",
    languages: ["ja"],
    hourlyRateCents: euros(12), // tramo community
    contractedHoursWeek: 24,
    hiredAt: weeksAgo(20),
    isNativeSpeaker: true,
  });

  const marc = await b.teacher({
    name: "Marc Delaunay",
    tier: "professional",
    languages: ["fr"],
    hourlyRateCents: euros(26),
    contractedHoursWeek: 24,
    hiredAt: weeksAgo(14),
    isNativeSpeaker: true,
  });

  // Profesora que ya no está: sus clases pasadas siguen en el histórico.
  const elena = await b.teacher({
    name: "Elena Sarmiento",
    tier: "professional",
    languages: ["es"],
    hourlyRateCents: euros(27),
    contractedHoursWeek: 12,
    hiredAt: weeksAgo(80),
    status: "left",
    leftAt: weeksAgo(6),
    leftReason: "Traslado a otra ciudad",
  });

  for (const t of [carla, dan, sofia, marc]) {
    await b.availability(t.profile.id, [
      { weekday: 1, from: 9, to: 14 },
      { weekday: 2, from: 9, to: 14 },
      { weekday: 3, from: 16, to: 21 },
      { weekday: 4, from: 16, to: 21 },
      { weekday: 5, from: 9, to: 13 },
    ]);
  }
  await b.availability(yuki.profile.id, [
    { weekday: 2, from: 18, to: 21 },
    { weekday: 4, from: 18, to: 21 },
  ]);

  /* ── Cursos ──────────────────────────────────────────────────────────── */
  // Estructura estándar del sector: 60 minutos, grupos de 5, ~50 sesiones por
  // media sección de nivel MCER.

  const esB1 = await b.course({
    code: "ES-B1-GRP",
    language: "es",
    level: "B1",
    modality: "group",
    priceCents: euros(690),
    totalSessions: 50,
    translations: [
      { locale: "es-ES", name: "Español B1 — grupo", description: "Nivel intermedio, 50 sesiones." },
      { locale: "en-GB", name: "Spanish B1 — group", description: "Intermediate level, 50 sessions." },
      { locale: "gl-ES", name: "Español B1 — grupo" },
    ],
  });

  const esA2 = await b.course({
    code: "ES-A2-GRP",
    language: "es",
    level: "A2",
    modality: "group",
    priceCents: euros(590),
    translations: [
      { locale: "es-ES", name: "Español A2 — grupo" },
      { locale: "en-GB", name: "Spanish A2 — group" },
    ],
  });

  const esA1Priv = await b.course({
    code: "ES-A1-PRV",
    language: "es",
    level: "A1",
    modality: "private",
    priceCents: euros(1200),
    maxStudents: 1,
    translations: [
      { locale: "es-ES", name: "Español A1 — clases particulares" },
      { locale: "en-GB", name: "Spanish A1 — private lessons" },
    ],
  });

  const enB2Biz = await b.course({
    code: "EN-B2-BIZ",
    language: "en",
    level: "B2",
    modality: "business",
    priceCents: euros(890),
    translations: [
      { locale: "es-ES", name: "Inglés de negocios B2" },
      { locale: "en-GB", name: "Business English B2" },
    ],
  });

  const esC1Dele = await b.course({
    code: "ES-C1-DELE",
    language: "es",
    level: "C1",
    modality: "exam_prep",
    priceCents: euros(950),
    translations: [
      { locale: "es-ES", name: "Preparación DELE C1" },
      { locale: "en-GB", name: "DELE C1 exam preparation" },
    ],
  });

  const jaA1 = await b.course({
    code: "JA-A1-CNV",
    language: "ja",
    level: "A1",
    modality: "conversation",
    priceCents: euros(390),
    translations: [{ locale: "es-ES", name: "Japonés A1 — conversación" }],
  });

  const frB2 = await b.course({
    code: "FR-B2-GRP",
    language: "fr",
    level: "B2",
    modality: "group",
    priceCents: euros(690),
    translations: [{ locale: "es-ES", name: "Francés B2 — grupo" }],
  });

  /* ── Grupos ──────────────────────────────────────────────────────────── */

  const gEsB1 = await b.group({
    courseId: esB1.id,
    teacherProfileId: carla.profile.id,
    name: "B1 — martes y jueves 18:00",
    startsOn: weeksAgo(10),
    status: "running",
  });
  const gEsA2 = await b.group({
    courseId: esA2.id,
    teacherProfileId: carla.profile.id,
    name: "A2 — lunes y miércoles 10:00",
    startsOn: weeksAgo(8),
    status: "running",
  });
  const gEsA1 = await b.group({
    courseId: esA1Priv.id,
    teacherProfileId: carla.profile.id,
    name: "A1 particular — Paula",
    capacity: 1,
    startsOn: weeksAgo(12),
    status: "running",
  });
  const gEnBiz = await b.group({
    courseId: enB2Biz.id,
    teacherProfileId: sofia.profile.id,
    name: "Business B2 — miércoles 19:00",
    startsOn: weeksAgo(9),
    status: "running",
  });
  const gDele = await b.group({
    courseId: esC1Dele.id,
    teacherProfileId: dan.profile.id,
    name: "DELE C1 — intensivo de otoño",
    startsOn: weeksAgo(6),
    status: "running",
  });
  const gJa = await b.group({
    courseId: jaA1.id,
    teacherProfileId: yuki.profile.id,
    name: "Japonés A1 — jueves 19:00",
    startsOn: weeksAgo(5),
    status: "running",
  });
  const gFr = await b.group({
    courseId: frB2.id,
    teacherProfileId: marc.profile.id,
    name: "Francés B2 — viernes 17:00",
    startsOn: weeksAgo(4),
    status: "running",
  });
  // Grupo que terminó: sirve para probar el histórico y los informes cerrados.
  const gFinished = await b.group({
    courseId: esA2.id,
    teacherProfileId: elena.profile.id,
    name: "A2 — grupo de primavera (cerrado)",
    startsOn: weeksAgo(30),
    endsOn: weeksAgo(7),
    status: "finished",
  });

  await b.recurrence({
    groupId: gEsB1.id,
    rrule: "FREQ=WEEKLY;BYDAY=TU,TH;COUNT=50",
    startsAt: weeksAgo(10),
  });

  /* ── Alumnado con nombre: los casos que hay que poder enseñar ────────── */

  // 1. Riesgo de baja por asistencia — 4 de 12 clases.
  const lucia = await b.student({
    name: "Lucía Ferrán",
    dateOfBirth: birthDateForAge(20),
    nativeLanguage: "ca",
    targetLanguage: "es",
    currentLevel: "B1",
    targetLevel: "B2",
    goals: "Aprobar el B1 antes de septiembre.",
    joinedAt: weeksAgo(10),
  });

  // 2. Menor de edad con tutor legal + también en riesgo.
  const adrian = await b.student({
    name: "Adrián Mota",
    dateOfBirth: birthDateForAge(17),
    nativeLanguage: "es",
    targetLanguage: "en",
    currentLevel: "A2",
    targetLevel: "B1",
    joinedAt: weeksAgo(8),
  });
  const adrianTutor = await b.guardian({
    name: "Pilar Mota",
    studentProfileId: adrian.profile.id,
    studentMembershipId: adrian.membership.id,
    relationship: "mother",
    isBillingContact: true,
  });

  // 3. Buena asistencia pero nadie la ha valorado en cinco semanas.
  const nerea = await b.student({
    name: "Nerea Ojeda",
    dateOfBirth: birthDateForAge(31),
    nativeLanguage: "es",
    targetLanguage: "es",
    currentLevel: "C1",
    targetLevel: "C2",
    goals: "Presentarse al DELE C1 en noviembre.",
    joinedAt: weeksAgo(6),
  });

  // 4. Ha dejado una reseña negativa sobre el material.
  const tomas = await b.student({
    name: "Tomás Iglesias",
    dateOfBirth: birthDateForAge(28),
    nativeLanguage: "es",
    targetLanguage: "en",
    currentLevel: "B2",
    targetLevel: "C1",
    joinedAt: weeksAgo(9),
    locale: "en-GB",
  });

  // 5. Asistencia perfecta y listo para subir de nivel.
  const paula = await b.student({
    name: "Paula Vidal",
    dateOfBirth: birthDateForAge(24),
    nativeLanguage: "gl",
    targetLanguage: "es",
    currentLevel: "A1",
    targetLevel: "A2",
    joinedAt: weeksAgo(12),
    locale: "gl-ES",
  });

  // 6. Baja consumada.
  const ivan = await b.student({
    name: "Iván Bergua",
    dateOfBirth: birthDateForAge(35),
    nativeLanguage: "es",
    targetLanguage: "fr",
    currentLevel: "B2",
    status: "left",
    joinedAt: weeksAgo(20),
    leftAt: weeksAgo(3),
    leftReason: "Cambio de horario laboral",
  });

  // 7. Matrícula congelada.
  const rocio = await b.student({
    name: "Rocío Amat",
    dateOfBirth: birthDateForAge(27),
    nativeLanguage: "es",
    targetLanguage: "ja",
    currentLevel: "A1",
    status: "paused",
    joinedAt: weeksAgo(14),
    pausedUntil: new Date(NOW.getTime() + 45 * 86_400_000),
  });

  // 8. Factura vencida sin pagar.
  const nestor = await b.student({
    name: "Néstor Quiroga",
    dateOfBirth: birthDateForAge(41),
    nativeLanguage: "es",
    targetLanguage: "en",
    currentLevel: "B2",
    joinedAt: weeksAgo(11),
  });

  // 9. Devolución total porque la escuela canceló las clases.
  const sara = await b.student({
    name: "Sara Llobet",
    dateOfBirth: birthDateForAge(29),
    nativeLanguage: "es",
    targetLanguage: "es",
    currentLevel: "B1",
    joinedAt: weeksAgo(7),
  });

  // 10. Menor pequeño SIN consentimiento de grabación: bloquea la transcripción
  //     de toda la clase en la que participe.
  const hugo = await b.student({
    name: "Hugo Peiró",
    dateOfBirth: birthDateForAge(9),
    nativeLanguage: "es",
    targetLanguage: "en",
    currentLevel: "A1",
    joinedAt: weeksAgo(5),
  });
  const hugoTutor = await b.guardian({
    name: "Beatriz Peiró",
    studentProfileId: hugo.profile.id,
    studentMembershipId: hugo.membership.id,
    relationship: "mother",
  });

  /* ── Consentimientos ─────────────────────────────────────────────────── */

  const adults = [lucia, nerea, tomas, paula, nestor, sara, ivan, rocio];
  for (const student of adults) {
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
  }

  // Adrián es menor: firma su madre.
  for (const kind of ["data_processing", "recording", "ai_processing"] as const) {
    await b.consent({
      subjectMembershipId: adrian.membership.id,
      kind,
      status: "granted",
      grantedByMembershipId: adrianTutor.membership.id,
      evidence: "Formulario firmado en la matrícula",
    });
  }

  // Hugo también es menor, pero su madre NO autorizó la grabación.
  await b.consent({
    subjectMembershipId: hugo.membership.id,
    kind: "data_processing",
    status: "granted",
    grantedByMembershipId: hugoTutor.membership.id,
  });
  await b.consent({
    subjectMembershipId: hugo.membership.id,
    kind: "recording",
    status: "denied",
    grantedByMembershipId: hugoTutor.membership.id,
    evidence: "La familia rechaza la grabación de las clases",
  });
  await b.consent({
    subjectMembershipId: hugo.membership.id,
    kind: "ai_processing",
    status: "granted",
    grantedByMembershipId: hugoTutor.membership.id,
  });

  // Una retirada de consentimiento posterior: el caso de «bórrame».
  await b.consent({
    subjectMembershipId: tomas.membership.id,
    kind: "marketing",
    status: "withdrawn",
    grantedByMembershipId: tomas.membership.id,
    withdrawnAt: weeksAgo(2),
  });

  /* ── Alumnado de relleno ─────────────────────────────────────────────── */

  const fillerNames = [
    "Alba Ferrer", "Bruno Sáez", "Clara Rejón", "Diego Nadal", "Elsa Montero",
    "Fran Bustos", "Gema Aliaga", "Hector Palau", "Irene Cózar", "Jaime Olmedo",
    "Keiko Morales", "Laura Bonet", "Mateo Ferreiro", "Noa Cabrera", "Óscar Villar",
    "Patricia Sanz", "Quim Batlle", "Raquel Espí", "Sergio Duarte", "Teresa Alonso",
    "Ulises Ramos", "Vera Padilla", "Walter Sosa", "Ximena Ruiz", "Yago Prieto",
    "Zaira Nogales", "Andrés Cuevas", "Berta Lozano", "Carlos Iriarte", "Daniela Rueda",
    "Emilio Vargas", "Fátima Sierra", "Gonzalo Ibáñez", "Helena Trigo", "Iker Moreno",
    "Julia Castaño", "Kevin Ortuño", "Lidia Fuster", "Manuel Arroyo", "Nadia Belmonte",
  ];

  const fillerStudents = [];
  for (const name of fillerNames.slice(0, FILLER_STUDENTS)) {
    const age = randomInt(16, 55);
    const student = await b.student({
      name,
      dateOfBirth: birthDateForAge(age),
      nativeLanguage: "es",
      targetLanguage: pick(["es", "en", "fr", "ja"]),
      currentLevel: pick(["A1", "A2", "B1", "B2", "C1"] as const),
      joinedAt: weeksAgo(randomInt(2, 24)),
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
      status: chance(0.85) ? "granted" : "denied",
      grantedByMembershipId: student.membership.id,
    });
    if (age < 18) {
      await b.guardian({
        name: `Tutor de ${name.split(" ")[0]}`,
        studentProfileId: student.profile.id,
        studentMembershipId: student.membership.id,
        relationship: pick(["mother", "father", "legal_guardian"] as const),
      });
    }
    fillerStudents.push(student);
  }

  /* ── Matrículas ──────────────────────────────────────────────────────── */

  await b.enroll({ groupId: gEsB1.id, studentProfileId: lucia.profile.id, enrolledAt: weeksAgo(10) });
  await b.enroll({ groupId: gEsB1.id, studentProfileId: sara.profile.id, enrolledAt: weeksAgo(7) });
  await b.enroll({ groupId: gEsA2.id, studentProfileId: adrian.profile.id, enrolledAt: weeksAgo(8) });
  await b.enroll({ groupId: gEsA1.id, studentProfileId: paula.profile.id, enrolledAt: weeksAgo(12) });
  await b.enroll({ groupId: gDele.id, studentProfileId: nerea.profile.id, enrolledAt: weeksAgo(6) });
  await b.enroll({ groupId: gEnBiz.id, studentProfileId: tomas.profile.id, enrolledAt: weeksAgo(9) });
  await b.enroll({ groupId: gEnBiz.id, studentProfileId: nestor.profile.id, enrolledAt: weeksAgo(11) });
  await b.enroll({ groupId: gEnBiz.id, studentProfileId: hugo.profile.id, enrolledAt: weeksAgo(5) });
  await b.enroll({ groupId: gJa.id, studentProfileId: rocio.profile.id, enrolledAt: weeksAgo(14) });
  await b.enroll({
    groupId: gFr.id,
    studentProfileId: ivan.profile.id,
    enrolledAt: weeksAgo(20),
    status: "withdrawn",
    endedAt: weeksAgo(3),
    endedReason: "Baja del alumno",
  });
  // Beca: precio acordado por debajo del de catálogo.
  await b.enroll({
    groupId: gEsB1.id,
    studentProfileId: fillerStudents[0]!.profile.id,
    enrolledAt: weeksAgo(9),
    agreedPriceCents: euros(490),
  });

  const groupPool = [gEsB1, gEsA2, gEnBiz, gDele, gJa, gFr];
  for (const [i, student] of fillerStudents.slice(1).entries()) {
    const group = groupPool[i % groupPool.length]!;
    await b.enroll({
      groupId: group.id,
      studentProfileId: student.profile.id,
      enrolledAt: weeksAgo(randomInt(1, 9)),
    });
  }
  // Grupo cerrado, con matrículas completadas.
  for (const student of fillerStudents.slice(0, 4)) {
    await b.enroll({
      groupId: gFinished.id,
      studentProfileId: student.profile.id,
      enrolledAt: weeksAgo(30),
      status: "completed",
      endedAt: weeksAgo(7),
    });
  }

  /* ── Rúbricas y contenido ────────────────────────────────────────────── */

  const rubrics = await b.rubrics();
  const rubricIds = { escrita: rubrics.escrita.id, oral: rubrics.oral.id };

  // Unidad publicada — la del mockup del generador.
  const doctorUnit = await b.unit({
    courseId: esB1.id,
    code: "ES-B1-U07",
    language: "es",
    level: "B1",
    topic: "En la consulta del médico",
    skills: ["listening", "vocabulary", "writing", "phonetics", "speaking", "grammar"],
    source: "ai_generated",
    status: "published",
    primaryLocale: "es-ES",
    translations: [
      {
        locale: "es-ES",
        title: "En la consulta del médico",
        description: "Pedir cita, describir síntomas y entender indicaciones.",
        body: "Unidad centrada en el lenguaje de la salud en contexto de atención primaria.",
      },
      {
        locale: "en-GB",
        title: "At the doctor's office",
        description: "Booking an appointment, describing symptoms, following instructions.",
        machineTranslated: true,
      },
    ],
    exercises: ES_B1_DOCTOR_EXERCISES,
    rubricIds,
    createdByMembershipId: carla.membership.id,
    reviewedByMembershipId: carla.membership.id,
    reviewedAt: daysAgo(9),
    publishedAt: daysAgo(9),
    createdAt: daysAgo(10),
    generationCostCents: 184,
    creditsSpent: 18,
    assets: [
      { kind: "audio", provider: "tts", durationMs: 252_000, bytes: 4_032_000 },
      {
        kind: "image",
        provider: "image-gen",
        bytes: 180_000,
        altText: { "es-ES": "Sala de espera de un centro de salud", "en-GB": "A clinic waiting room" },
      },
      { kind: "image", provider: "image-gen", bytes: 164_000 },
    ],
  });

  // Unidad generada pero pendiente de revisión: nadie ha firmado todavía.
  const marketUnit = await b.unit({
    courseId: esA2.id,
    code: "ES-A2-U03",
    language: "es",
    level: "A2",
    topic: "Hacer la compra en el mercado",
    skills: ["listening", "vocabulary", "speaking"],
    source: "ai_generated",
    status: "in_review",
    primaryLocale: "es-ES",
    translations: [
      { locale: "es-ES", title: "Hacer la compra en el mercado", description: "Cantidades, precios y regateo suave." },
    ],
    exercises: ES_B1_DOCTOR_EXERCISES.slice(0, 3),
    rubricIds,
    createdByMembershipId: carla.membership.id,
    createdAt: daysAgo(2),
    generationCostCents: 121,
    creditsSpent: 12,
    assets: [{ kind: "audio", provider: "tts", durationMs: 188_000 }],
  });

  // Material propio subido por la escuela: sin coste de IA.
  const uploadedUnit = await b.unit({
    courseId: esC1Dele.id,
    code: "ES-C1-DELE-01",
    language: "es",
    level: "C1",
    topic: "Modelo de examen DELE C1 — comprensión de lectura",
    skills: ["reading"],
    source: "uploaded",
    status: "published",
    primaryLocale: "es-ES",
    translations: [{ locale: "es-ES", title: "Modelo DELE C1 — lectura", description: "Material propio de la escuela." }],
    exercises: [],
    rubricIds,
    createdByMembershipId: ruben.membership.id,
    reviewedByMembershipId: dan.membership.id,
    reviewedAt: weeksAgo(4),
    publishedAt: weeksAgo(4),
    createdAt: weeksAgo(4),
    generationCostCents: 0,
    creditsSpent: 0,
    assets: [{ kind: "document", provider: "upload", bytes: 1_240_000 }],
  });

  // Unidad de inglés de negocios, con un vídeo en beta.
  const bizUnit = await b.unit({
    courseId: enB2Biz.id,
    code: "EN-B2-U04",
    language: "en",
    level: "B2",
    topic: "Negotiating a deadline",
    skills: ["reading", "writing", "vocabulary"],
    source: "hybrid",
    status: "published",
    primaryLocale: "en-GB",
    translations: [
      { locale: "en-GB", title: "Negotiating a deadline", description: "Formal register for pushing back on dates." },
      { locale: "es-ES", title: "Negociar un plazo", machineTranslated: true },
    ],
    exercises: EN_B2_BUSINESS_EXERCISES,
    rubricIds,
    createdByMembershipId: sofia.membership.id,
    reviewedByMembershipId: sofia.membership.id,
    reviewedAt: weeksAgo(3),
    publishedAt: weeksAgo(3),
    createdAt: weeksAgo(3),
    generationCostCents: 260,
    creditsSpent: 26,
    assets: [
      { kind: "audio", provider: "tts", durationMs: 143_000 },
      { kind: "video", provider: "video-gen", durationMs: 45_000, bytes: 18_400_000, isBeta: true },
    ],
  });

  /* ── Créditos de IA ──────────────────────────────────────────────────── */

  await b.grantCredits({
    credits: 500,
    reason: "plan_grant",
    note: "Créditos incluidos en el plan Crecimiento",
    createdAt: weeksAgo(4),
  });
  await b.grantCredits({
    credits: 200,
    reason: "topup",
    note: "Recarga de 200 créditos",
    createdAt: weeksAgo(1),
  });

  await b.aiGeneration({
    kind: "unit_body",
    status: "succeeded",
    provider: "anthropic",
    model: "claude-opus-5",
    inputTokens: 4_120,
    outputTokens: 6_890,
    costCents: 94,
    creditsCharged: 9,
    contentUnitId: doctorUnit.unit.id,
    requestedByMembershipId: carla.membership.id,
    createdAt: daysAgo(10),
  });
  await b.aiGeneration({
    kind: "audio_tts",
    status: "succeeded",
    provider: "tts",
    model: "tts-multilingual-v3",
    unitsProduced: 252,
    costCents: 62,
    creditsCharged: 6,
    contentUnitId: doctorUnit.unit.id,
    requestedByMembershipId: carla.membership.id,
    createdAt: daysAgo(10),
  });
  await b.aiGeneration({
    kind: "image",
    status: "succeeded",
    provider: "image-gen",
    model: "image-v4",
    unitsProduced: 12,
    costCents: 28,
    creditsCharged: 3,
    contentUnitId: doctorUnit.unit.id,
    requestedByMembershipId: carla.membership.id,
    createdAt: daysAgo(10),
  });
  // Generación fallida: no se cobra al cliente, pero el coste ya se pagó.
  await b.aiGeneration({
    kind: "video_beta",
    status: "failed",
    provider: "video-gen",
    model: "video-beta-v2",
    costCents: 140,
    creditsCharged: 0,
    contentUnitId: bizUnit.unit.id,
    requestedByMembershipId: sofia.membership.id,
    errorCode: "generation_timeout",
    errorMessage: "El proveedor no devolvió el vídeo en 300 s",
    createdAt: weeksAgo(3),
    durationMs: 300_000,
  });
  // Generación pedida desde Claude vía MCP.
  await b.aiGeneration({
    kind: "session_summary",
    status: "succeeded",
    provider: "anthropic",
    model: "claude-opus-5",
    inputTokens: 12_400,
    outputTokens: 890,
    costCents: 18,
    creditsCharged: 2,
    requestedByMembershipId: marta.membership.id,
    origin: "mcp",
    createdAt: daysAgo(1),
  });

  /* ── Clases ──────────────────────────────────────────────────────────── */
  //
  // La ocupación de esta semana está construida para que el panel muestre
  // exactamente los porcentajes del diseño: Carla 92 %, Dan 83 %, Sofia 75 %,
  // Yuki 46 %, Marc 38 % sobre 24 horas contratadas.

  const teacherLoad: Array<{
    teacher: { profile: { id: string }; membership: { id: string } };
    group: { id: string };
    sessionsThisWeek: number;
    provider: "livekit" | "zoom" | "google_meet" | "ms_teams";
  }> = [
    { teacher: carla, group: gEsB1, sessionsThisWeek: 22, provider: "livekit" },
    { teacher: dan, group: gDele, sessionsThisWeek: 20, provider: "zoom" },
    { teacher: sofia, group: gEnBiz, sessionsThisWeek: 18, provider: "google_meet" },
    { teacher: yuki, group: gJa, sessionsThisWeek: 11, provider: "ms_teams" },
    { teacher: marc, group: gFr, sessionsThisWeek: 9, provider: "livekit" },
  ];

  const thisWeekSessions = [];
  for (const load of teacherLoad) {
    for (let i = 0; i < load.sessionsThisWeek; i++) {
      const weekday = (i % 5) + 1;
      const hour = 9 + Math.floor(i / 5) * 2;
      const start = weekSlot(0, weekday, Math.min(hour, 20));
      const isPast = start < NOW;
      const session = await b.session({
        groupId: load.group.id,
        teacherProfileId: load.teacher.profile.id,
        start,
        minutes: 60,
        status: isPast ? "completed" : "scheduled",
        roomProvider: load.provider,
        topic: isPast ? "Repaso de la unidad" : "Unidad nueva",
        contentUnitId: load.group.id === gEsB1.id ? doctorUnit.unit.id : null,
      });
      thisWeekSessions.push({ session, teacher: load.teacher, group: load.group });
    }
  }

  /* Histórico del grupo B1: 12 clases, con la asistencia que produce los
     casos de riesgo del panel. */
  const b1History = [];
  for (let week = 6; week >= 1; week--) {
    for (const weekday of [2, 4]) {
      const start = weekSlot(-week, weekday, 18);
      const session = await b.session({
        groupId: gEsB1.id,
        teacherProfileId: carla.profile.id,
        start,
        minutes: 60,
        status: "completed",
        roomProvider: "livekit",
        topic: "Sesión de grupo",
        contentUnitId: doctorUnit.unit.id,
      });
      b1History.push(session);
    }
  }

  // Lucía: 4 de 12 → riesgo de baja.
  for (const [i, session] of b1History.entries()) {
    await b.attend({
      sessionId: session.id,
      studentProfileId: lucia.profile.id,
      status: i < 4 ? "present" : "absent",
      source: "auto",
      sessionStart: session.scheduledStart,
      recordedByMembershipId: carla.membership.id,
    });
    // Sara: asistencia alta.
    await b.attend({
      sessionId: session.id,
      studentProfileId: sara.profile.id,
      status: i === 3 ? "late" : "present",
      source: "auto",
      sessionStart: session.scheduledStart,
    });
  }

  // Adrián: 9 de 12 en su grupo A2.
  const a2History = [];
  for (let week = 6; week >= 1; week--) {
    for (const weekday of [1, 3]) {
      const start = weekSlot(-week, weekday, 10);
      const session = await b.session({
        groupId: gEsA2.id,
        teacherProfileId: carla.profile.id,
        start,
        minutes: 60,
        status: "completed",
        roomProvider: "livekit",
      });
      a2History.push(session);
    }
  }
  for (const [i, session] of a2History.entries()) {
    await b.attend({
      sessionId: session.id,
      studentProfileId: adrian.profile.id,
      status: i >= 9 ? "absent" : "present",
      source: "auto",
      sessionStart: session.scheduledStart,
    });
  }

  // Paula: 12 de 12 en su clase particular → lista para subir de nivel.
  const paulaSessions = [];
  for (let week = 12; week >= 1; week--) {
    const start = weekSlot(-week, 3, 17);
    const session = await b.session({
      groupId: gEsA1.id,
      teacherProfileId: carla.profile.id,
      start,
      minutes: 60,
      status: "completed",
      roomProvider: "livekit",
    });
    paulaSessions.push(session);
    await b.attend({
      sessionId: session.id,
      studentProfileId: paula.profile.id,
      status: "present",
      source: "auto",
      sessionStart: start,
    });
  }

  // Nerea: asistencia alta en DELE, 11 de 12.
  const deleHistory = [];
  for (let week = 6; week >= 1; week--) {
    for (const weekday of [2, 5]) {
      const start = weekSlot(-week, weekday, 19);
      const session = await b.session({
        groupId: gDele.id,
        teacherProfileId: dan.profile.id,
        start,
        minutes: 60,
        status: "completed",
        roomProvider: "zoom",
      });
      deleHistory.push(session);
      await b.attend({
        sessionId: session.id,
        studentProfileId: nerea.profile.id,
        status: week === 4 && weekday === 5 ? "excused" : "present",
        source: "imported", // viene del informe de asistencia de Zoom
        sessionStart: start,
      });
    }
  }

  // Clase cancelada por el alumno con poca antelación.
  await b.session({
    groupId: gEsB1.id,
    teacherProfileId: carla.profile.id,
    start: weekSlot(-1, 4, 18),
    minutes: 60,
    status: "canceled_by_student",
    roomProvider: "livekit",
    canceledAt: weekSlot(-1, 4, 15),
    canceledByMembershipId: lucia.membership.id,
    cancelReason: "Aviso con 3 horas: no procede devolución",
    cancelNoticeHours: 3,
  });

  // Clase cancelada por la escuela: sí genera devolución.
  const canceledBySchool = await b.session({
    groupId: gEsB1.id,
    teacherProfileId: carla.profile.id,
    start: weekSlot(-2, 2, 18),
    minutes: 60,
    status: "canceled_by_school",
    roomProvider: "livekit",
    canceledAt: weekSlot(-2, 1, 9),
    canceledByMembershipId: ruben.membership.id,
    cancelReason: "Baja médica de la profesora",
    cancelNoticeHours: 33,
  });

  // Replanificación: la original queda marcada y apunta a la nueva.
  const original = await b.session({
    groupId: gEnBiz.id,
    teacherProfileId: sofia.profile.id,
    start: weekSlot(-1, 3, 19),
    minutes: 60,
    status: "rescheduled",
    roomProvider: "google_meet",
    cancelReason: "Conflicto de agenda del grupo",
  });
  await b.session({
    groupId: gEnBiz.id,
    teacherProfileId: sofia.profile.id,
    start: weekSlot(-1, 5, 19),
    minutes: 60,
    status: "completed",
    roomProvider: "google_meet",
    rescheduledFromSessionId: original.id,
  });

  // Clase a la que no se conectó nadie.
  const noShow = await b.session({
    groupId: gJa.id,
    teacherProfileId: yuki.profile.id,
    start: weekSlot(-1, 4, 19),
    minutes: 60,
    status: "no_show",
    roomProvider: "ms_teams",
  });
  await b.attend({
    sessionId: noShow.id,
    studentProfileId: rocio.profile.id,
    status: "absent",
    source: "auto",
    sessionStart: noShow.scheduledStart,
    note: "Nadie se conectó",
  });

  /* Calendario futuro: las próximas tres semanas.
   *
   * No es adorno. Sin clases por venir no se puede probar cancelar,
   * replanificar ni el aviso de devolución —y el calendario aparece vacío
   * justo el día que alguien abre la demo en domingo, cuando la semana en
   * curso ya terminó. */
  for (const semana of [1, 2, 3]) {
    for (const load of teacherLoad) {
      const clasesPorSemana = Math.ceil(load.sessionsThisWeek / 3);
      for (let i = 0; i < clasesPorSemana; i++) {
        const weekday = (i % 5) + 1;
        const hour = Math.min(9 + Math.floor(i / 5) * 2, 20);
        await b.session({
          groupId: load.group.id,
          teacherProfileId: load.teacher.profile.id,
          start: weekSlot(semana, weekday, hour),
          minutes: 60,
          status: "scheduled",
          roomProvider: load.provider,
          topic: semana === 1 ? "Unidad 8 — En la farmacia" : "Por planificar",
          contentUnitId: load.group.id === gEsB1.id ? doctorUnit.unit.id : null,
        });
      }
    }
  }

  // Clase con Hugo, el menor sin consentimiento de grabación.
  const hugoSession = await b.session({
    groupId: gEnBiz.id,
    teacherProfileId: sofia.profile.id,
    start: weekSlot(-1, 1, 17),
    minutes: 60,
    status: "completed",
    roomProvider: "livekit",
    topic: "Inglés para peques",
  });
  await b.attend({
    sessionId: hugoSession.id,
    studentProfileId: hugo.profile.id,
    status: "present",
    source: "auto",
    sessionStart: hugoSession.scheduledStart,
  });

  /* ── Intentos y correcciones ─────────────────────────────────────────── */

  const clozeEx = doctorUnit.exercises.find((e) => e.type === "cloze")!;
  const writingEx = doctorUnit.exercises.find((e) => e.type === "written_production")!;
  const pairsEx = doctorUnit.exercises.find((e) => e.type === "minimal_pairs")!;

  await b.attempt({
    exerciseId: clozeEx.id,
    studentProfileId: lucia.profile.id,
    response: { 1: "desde", 2: "tragar" },
    status: "ai_graded",
    aiScore: 2,
    aiFeedback: "Ambos huecos correctos.",
    submittedAt: daysAgo(8),
  });

  // Corrección de IA ya validada por la profesora: la nota cuenta.
  await b.attempt({
    exerciseId: writingEx.id,
    studentProfileId: nerea.profile.id,
    response: {
      text: "Estimado doctor: le escribo para solicitar una cita esta semana, si es posible por la tarde...",
      wordCount: 94,
    },
    status: "teacher_validated",
    aiScore: 16,
    aiFeedback: "Registro adecuado. Revisar concordancia en dos oraciones subordinadas.",
    aiRubricScores: { adecuacion: 5, coherencia: 4, lexico: 4, correccion: 3 },
    teacherScore: 17,
    teacherFeedback: "De acuerdo con la corrección automática; subo medio punto por el cierre formal.",
    validatedByMembershipId: dan.membership.id,
    submittedAt: daysAgo(6),
  });

  // Corrección de IA pendiente de firma: NO debe contar todavía.
  await b.attempt({
    exerciseId: writingEx.id,
    studentProfileId: tomas.profile.id,
    response: { text: "Hola doctor, necesito una cita porque me encuentro mal desde el lunes...", wordCount: 81 },
    status: "ai_graded",
    aiScore: 11,
    aiFeedback: "Registro demasiado informal para la tarea. Faltan fórmulas de cortesía.",
    aiRubricScores: { adecuacion: 2, coherencia: 3, lexico: 3, correccion: 3 },
    submittedAt: daysAgo(2),
  });

  // Devuelto para rehacer.
  await b.attempt({
    exerciseId: writingEx.id,
    studentProfileId: adrian.profile.id,
    response: { text: "quiero cita", wordCount: 3 },
    status: "returned",
    aiScore: 2,
    aiFeedback: "No cumple la extensión mínima de 80 palabras.",
    teacherFeedback: "Vuelve a intentarlo siguiendo el modelo de la unidad.",
    validatedByMembershipId: carla.membership.id,
    submittedAt: daysAgo(3),
  });

  // Varios intentos del mismo ejercicio: prueba el contador de reintentos.
  for (let n = 1; n <= 3; n++) {
    await b.attempt({
      exerciseId: pairsEx.id,
      studentProfileId: paula.profile.id,
      response: { sequence: n === 3 ? ["b", "a", "b"] : ["a", "a", "b"] },
      status: "ai_graded",
      aiScore: n === 3 ? 3 : 1,
      attemptNumber: n,
      submittedAt: daysAgo(10 - n),
    });
  }

  /* ── Repaso espaciado ────────────────────────────────────────────────── */
  //
  // Tres estados que la pantalla de repaso tiene que saber pintar: vencida,
  // pendiente para hoy y ya consolidada.

  const srsExercises = doctorUnit.exercises.filter((e) => e.srsEnabled);

  for (const [i, exercise] of srsExercises.entries()) {
    // Lucía falla y repite: intervalo corto, facilidad baja, varios fallos.
    await b.srsCard({
      studentProfileId: lucia.profile.id,
      exerciseId: exercise.id,
      ease: 1.7,
      intervalDays: 1,
      repetitions: 1,
      lapses: 3,
      dueOn: daysAgo(2), // vencida: lleva dos días sin repasar
      lastReviewedAt: daysAgo(3),
    });

    // Nerea va al día: intervalo largo y sin fallos.
    await b.srsCard({
      studentProfileId: nerea.profile.id,
      exerciseId: exercise.id,
      ease: 2.8,
      intervalDays: 21,
      repetitions: 5,
      lapses: 0,
      dueOn: daysFromNow(14 + i),
      lastReviewedAt: daysAgo(7),
    });

    // Paula tiene repaso hoy.
    await b.srsCard({
      studentProfileId: paula.profile.id,
      exerciseId: exercise.id,
      ease: 2.5,
      intervalDays: 6,
      repetitions: 3,
      lapses: 1,
      dueOn: NOW,
      lastReviewedAt: daysAgo(6),
    });
  }

  // Relleno para que la pantalla de repaso no salga con tres filas.
  for (const student of fillerStudents.slice(0, 12)) {
    for (const exercise of srsExercises.slice(0, 2)) {
      await b.srsCard({
        studentProfileId: student.profile.id,
        exerciseId: exercise.id,
        ease: 2.0 + randomInt(0, 8) / 10,
        intervalDays: randomInt(1, 30),
        repetitions: randomInt(0, 6),
        lapses: randomInt(0, 3),
        dueOn: daysFromNow(randomInt(-3, 20)),
        lastReviewedAt: daysAgo(randomInt(1, 14)),
      });
    }
  }

  /* ── Exámenes y nivelación ───────────────────────────────────────────── */

  await b.assessment({
    kind: "placement",
    studentProfileId: paula.profile.id,
    title: "Prueba de nivelación de español",
    language: "es",
    levelBefore: null,
    levelResult: "A1",
    score: 34,
    maxScore: 100,
    skillBreakdown: { listening: 0.4, reading: 0.38, writing: 0.28, grammar: 0.3 },
    status: "teacher_validated",
    submittedAt: weeksAgo(12),
    gradedAt: weeksAgo(12),
    validatedByMembershipId: carla.membership.id,
  });

  // Paula ha progresado: examen de nivel que la sitúa ya en A2.
  await b.assessment({
    kind: "level_exam",
    studentProfileId: paula.profile.id,
    courseId: esA1Priv.id,
    title: "Examen de fin de nivel A1",
    language: "es",
    levelBefore: "A1",
    levelResult: "A2",
    score: 86,
    maxScore: 100,
    skillBreakdown: { listening: 0.88, reading: 0.9, writing: 0.82, speaking: 0.84 },
    status: "teacher_validated",
    submittedAt: daysAgo(5),
    gradedAt: daysAgo(4),
    validatedByMembershipId: carla.membership.id,
  });

  await b.assessment({
    kind: "mock_official",
    studentProfileId: nerea.profile.id,
    courseId: esC1Dele.id,
    title: "Simulacro DELE C1",
    language: "es",
    levelBefore: "C1",
    score: 71,
    maxScore: 100,
    skillBreakdown: { listening: 0.68, reading: 0.79, writing: 0.66, speaking: 0.72 },
    status: "ai_graded",
    submittedAt: daysAgo(3),
    gradedAt: daysAgo(3),
  });

  // Examen programado que aún no se ha hecho.
  await b.assessment({
    kind: "unit_exam",
    studentProfileId: tomas.profile.id,
    contentUnitId: bizUnit.unit.id,
    title: "Examen de unidad — Negotiating a deadline",
    language: "en",
    levelBefore: "B2",
    status: "scheduled",
    scheduledFor: weekSlot(1, 3, 19),
  });

  /* ── Valoraciones del profesorado ────────────────────────────────────── */

  await b.evaluation({
    teacherProfileId: carla.profile.id,
    studentProfileId: paula.profile.id,
    periodStart: weeksAgo(6),
    periodEnd: daysAgo(3),
    progressRating: 5,
    levelAtEvaluation: "A1",
    strengths: "Constancia total y muy buena pronunciación.",
    improvements: "Ampliar vocabulario de ámbito laboral.",
    nextSteps: "Pasar al grupo A2 en septiembre.",
    createdAt: daysAgo(3),
  });

  await b.evaluation({
    teacherProfileId: carla.profile.id,
    studentProfileId: lucia.profile.id,
    periodStart: weeksAgo(6),
    periodEnd: weeksAgo(2),
    progressRating: 2,
    levelAtEvaluation: "B1",
    strengths: "Buena comprensión lectora cuando asiste.",
    improvements: "La asistencia es el problema principal.",
    nextSteps: "Llamada de seguimiento antes de fin de mes.",
    createdAt: weeksAgo(2),
  });

  // Adrián es menor: la valoración la ve también su madre.
  await b.evaluation({
    teacherProfileId: carla.profile.id,
    studentProfileId: adrian.profile.id,
    periodStart: weeksAgo(8),
    periodEnd: weeksAgo(1),
    progressRating: 3,
    levelAtEvaluation: "A2",
    strengths: "Participa bien en las actividades orales.",
    improvements: "Faltas recientes sin justificar.",
    nextSteps: "Hablar con la familia sobre el horario.",
    visibleToGuardian: true,
    createdAt: weeksAgo(1),
  });

  // Nerea NO tiene valoración: es el caso «alumnos sin valorar» del panel.

  /* ── Satisfacción ────────────────────────────────────────────────────── */

  const nps = await b.survey({
    kind: "nps",
    code: "nps-trimestral",
    name: "NPS trimestral de alumnado",
    audience: "student",
  });
  const csat = await b.survey({
    kind: "post_session",
    code: "csat-clase",
    name: "¿Qué tal la clase?",
    audience: "student",
    autoSendAfterSession: true,
  });
  const teacherPulse = await b.survey({
    kind: "teacher_pulse",
    code: "pulse-profes",
    name: "Pulso mensual del profesorado",
    audience: "teacher",
  });

  // Un NPS que da aproximadamente +41: promotores, pasivos y detractores.
  const npsRespondents: Array<[{ membership: { id: string } }, number]> = [
    [paula, 10], [nerea, 9], [sara, 9], [tomas, 6], [lucia, 4], [nestor, 7], [adrian, 8],
  ];
  for (const [student, score] of npsRespondents) {
    await b.surveyResponse({
      surveyId: nps.id,
      respondentMembershipId: student.membership.id,
      respondentKind: "student",
      score,
      submittedAt: weeksAgo(randomInt(1, 5)),
    });
  }
  for (const student of fillerStudents.slice(0, 24)) {
    await b.surveyResponse({
      surveyId: nps.id,
      respondentMembershipId: student.membership.id,
      respondentKind: "student",
      score: pick([10, 10, 9, 9, 9, 8, 8, 7, 6, 5]),
      submittedAt: weeksAgo(randomInt(1, 8)),
    });
  }

  // CSAT ligado a clases concretas y a su profesor.
  for (const { session, teacher } of thisWeekSessions.slice(0, 18)) {
    if (session.scheduledStart > NOW) continue;
    await b.surveyResponse({
      surveyId: csat.id,
      respondentMembershipId: pick(fillerStudents).membership.id,
      respondentKind: "student",
      sessionId: session.id,
      teacherProfileId: teacher.profile.id,
      score: pick([5, 5, 4, 4, 4, 3]),
      submittedAt: minutesAfter(session.scheduledStart, 90),
    });
  }

  // El propio profesorado también responde: alimenta la analítica de la ola 3.
  for (const t of [carla, dan, sofia, yuki, marc]) {
    await b.surveyResponse({
      surveyId: teacherPulse.id,
      respondentMembershipId: t.membership.id,
      respondentKind: "teacher",
      score: t.profile.id === yuki.profile.id ? 3 : pick([4, 5]),
      comment:
        t.profile.id === yuki.profile.id ? "Pocas horas asignadas este mes." : undefined,
      submittedAt: weeksAgo(1),
    });
  }

  /* ── Reseñas ─────────────────────────────────────────────────────────── */

  await b.review({
    authorMembershipId: tomas.membership.id,
    subject: "material",
    contentUnitId: bizUnit.unit.id,
    rating: 2,
    comment:
      "Los audios de la unidad suenan demasiado artificiales y el ejercicio de huecos tiene dos soluciones posibles.",
    createdAt: daysAgo(4),
  });
  await b.review({
    authorMembershipId: nerea.membership.id,
    subject: "material",
    contentUnitId: doctorUnit.unit.id,
    rating: 5,
    comment: "El vocabulario es justo el que necesitaba para mi cita real en el médico.",
    createdAt: daysAgo(6),
    acknowledgedByMembershipId: marta.membership.id,
  });
  await b.review({
    authorMembershipId: paula.membership.id,
    subject: "teacher",
    teacherProfileId: carla.profile.id,
    rating: 5,
    comment: "Carla adapta cada clase a lo que me cuesta. He avanzado muchísimo.",
    createdAt: weeksAgo(2),
  });
  await b.review({
    authorMembershipId: lucia.membership.id,
    subject: "session",
    sessionId: b1History[0]!.id,
    rating: 3,
    comment: "Se fue mucho tiempo en repasar cosas del nivel anterior.",
    createdAt: weeksAgo(5),
  });

  /* ── Facturación ─────────────────────────────────────────────────────── */

  // Factura pagada, con comisión del 2 % retenida.
  await b.studentInvoice({
    studentProfileId: nerea.profile.id,
    billToMembershipId: nerea.membership.id,
    locale: "es-ES",
    lines: [{ description: "Preparación DELE C1 — mensualidad de julio", quantity: 1, unitCents: euros(190), courseId: esC1Dele.id }],
    taxRateBps: 0, // enseñanza reglada exenta de IVA en España
    status: "paid",
    issuedOn: daysAgo(24),
    dueOn: daysAgo(17),
    paidAt: daysAgo(22),
    paymentStatus: "succeeded",
  });

  // Menor: la factura va a nombre del tutor legal, no del alumno.
  await b.studentInvoice({
    studentProfileId: adrian.profile.id,
    billToMembershipId: adrianTutor.membership.id,
    locale: "es-ES",
    lines: [{ description: "Español A2 — mensualidad de julio", quantity: 1, unitCents: euros(145), courseId: esA2.id }],
    taxRateBps: 0,
    status: "paid",
    issuedOn: daysAgo(24),
    dueOn: daysAgo(17),
    paidAt: daysAgo(20),
    paymentStatus: "succeeded",
    paymentMethod: "sepa_debit",
  });

  // Vencida sin pagar.
  await b.studentInvoice({
    studentProfileId: nestor.profile.id,
    billToMembershipId: nestor.membership.id,
    locale: "es-ES",
    lines: [{ description: "Inglés de negocios B2 — mensualidad de julio", quantity: 1, unitCents: euros(178), courseId: enB2Biz.id }],
    taxRateBps: 0,
    status: "past_due",
    issuedOn: daysAgo(38),
    dueOn: daysAgo(24),
    paymentStatus: "failed",
    failureCode: "card_declined",
    failureMessage: "La tarjeta fue rechazada por el emisor",
  });

  // Devolución parcial: se cancelaron dos clases del mes.
  await b.studentInvoice({
    studentProfileId: lucia.profile.id,
    billToMembershipId: lucia.membership.id,
    locale: "es-ES",
    lines: [{ description: "Español B1 — mensualidad de junio", quantity: 1, unitCents: euros(138), courseId: esB1.id }],
    taxRateBps: 0,
    status: "paid",
    issuedOn: daysAgo(54),
    dueOn: daysAgo(47),
    paidAt: daysAgo(52),
    paymentStatus: "succeeded",
    refund: {
      amountCents: euros(23),
      reason: "service_not_provided",
      status: "succeeded",
      reversesApplicationFee: true,
      note: "Dos clases canceladas por la escuela",
      requestedByMembershipId: ruben.membership.id,
      createdAt: daysAgo(30),
    },
  });

  // Devolución total: la escuela canceló el mes entero.
  await b.studentInvoice({
    studentProfileId: sara.profile.id,
    billToMembershipId: sara.membership.id,
    locale: "es-ES",
    lines: [{ description: "Español B1 — mensualidad de julio", quantity: 1, unitCents: euros(138), courseId: esB1.id, sessionId: canceledBySchool.id }],
    taxRateBps: 0,
    status: "paid",
    issuedOn: daysAgo(24),
    dueOn: daysAgo(17),
    paidAt: daysAgo(23),
    paymentStatus: "succeeded",
    refund: {
      amountCents: euros(138),
      reason: "service_not_provided",
      status: "succeeded",
      reversesApplicationFee: true,
      note: "Baja médica de la profesora, mes completo devuelto",
      requestedByMembershipId: marta.membership.id,
      createdAt: daysAgo(14),
    },
  });

  // Factura en borrador, todavía sin emitir.
  await b.studentInvoice({
    studentProfileId: tomas.profile.id,
    billToMembershipId: tomas.membership.id,
    locale: "en-GB", // el alumno lee en inglés: la factura sale en su idioma
    lines: [{ description: "Business English B2 — August", quantity: 1, unitCents: euros(178), courseId: enB2Biz.id }],
    taxRateBps: 0,
    status: "draft",
    issuedOn: NOW,
    dueOn: new Date(NOW.getTime() + 7 * 86_400_000),
  });

  // Facturación de relleno: alimenta el KPI de facturación del mes.
  for (const student of fillerStudents.slice(0, 32)) {
    const paid = chance(0.88);
    await b.studentInvoice({
      studentProfileId: student.profile.id,
      billToMembershipId: student.membership.id,
      locale: "es-ES",
      lines: [{ description: "Mensualidad de julio", quantity: 1, unitCents: euros(randomInt(120, 200)) }],
      taxRateBps: 0,
      status: paid ? "paid" : "open",
      issuedOn: daysAgo(24),
      dueOn: daysAgo(17),
      paidAt: paid ? daysAgo(randomInt(10, 22)) : null,
      paymentStatus: paid ? "succeeded" : "pending",
    });
  }

  // Tu factura a la escuela: la suscripción. Nunca lleva comisión.
  await b.platformInvoice({
    planName: "Crecimiento",
    priceCents: euros(149),
    status: "paid",
    issuedOn: daysAgo(24),
    paidAt: daysAgo(24),
  });

  /* ── Transcripciones ─────────────────────────────────────────────────── */

  // Lista, generada en el aula propia.
  await b.transcript({
    sessionId: b1History[b1History.length - 1]!.id,
    status: "ready",
    provider: "livekit",
    language: "es",
    durationMs: 3_540_000,
    summary:
      "Repaso del vocabulario médico y práctica de la conversación en recepción. Se corrigió el uso de «desde hace» frente a «hace».",
    vocabulary: [
      { term: "receta", level: "B1", count: 7 },
      { term: "justificante", level: "B1", count: 4 },
      { term: "tragar", level: "B1", count: 6 },
      { term: "urgencias", level: "A2", count: 3 },
    ],
    segments: [
      { startMs: 0, endMs: 8200, text: "Buenas tardes a todos. Hoy vamos a repasar la unidad del médico.", speakerMembershipId: carla.membership.id, speakerLabel: "Carla", isTeacher: true },
      { startMs: 8200, endMs: 15400, text: "¿Alguien me puede decir cómo se pide una cita por teléfono?", speakerMembershipId: carla.membership.id, speakerLabel: "Carla", isTeacher: true },
      { startMs: 15400, endMs: 23100, text: "Buenos días, quería pedir cita con el médico de cabecera.", speakerMembershipId: sara.membership.id, speakerLabel: "Sara", isTeacher: false },
      { startMs: 23100, endMs: 29800, text: "Muy bien. Fíjate en el «quería»: es más cortés que «quiero».", speakerMembershipId: carla.membership.id, speakerLabel: "Carla", isTeacher: true },
    ],
    createdAt: b1History[b1History.length - 1]!.scheduledStart,
  });

  // Importada de Zoom.
  await b.transcript({
    sessionId: deleHistory[deleHistory.length - 1]!.id,
    status: "ready",
    provider: "zoom",
    language: "es",
    durationMs: 3_600_000,
    summary: "Práctica de comprensión auditiva del modelo DELE C1 y corrección de la tarea escrita.",
    vocabulary: [{ term: "argumentar", level: "C1", count: 9 }],
    createdAt: deleHistory[deleHistory.length - 1]!.scheduledStart,
  });

  // BLOQUEADA: en la clase había un menor cuya familia no autorizó la grabación.
  await b.transcript({
    sessionId: hugoSession.id,
    status: "blocked_no_consent",
    provider: "livekit",
    language: "en",
    blockedReason:
      "El tutor legal de un participante menor no ha autorizado la grabación. No se generó ni audio ni transcripción.",
    createdAt: hugoSession.scheduledStart,
  });

  // En proceso.
  await b.transcript({
    sessionId: thisWeekSessions[0]!.session.id,
    status: "processing",
    provider: "livekit",
    language: "es",
    createdAt: daysAgo(1),
  });

  /* ── MCP ─────────────────────────────────────────────────────────────── */

  const claudeClient = await b.mcpClient({
    name: "Claude — dirección",
    clientKind: "claude",
    scopes: ["students:read", "sessions:read", "analytics:read"],
    authorizedByMembershipId: marta.membership.id,
    lastUsedAt: daysAgo(1),
  });
  const chatgptClient = await b.mcpClient({
    name: "ChatGPT — pruebas",
    clientKind: "chatgpt",
    scopes: ["students:read"],
    authorizedByMembershipId: ruben.membership.id,
    lastUsedAt: weeksAgo(5),
    revokedAt: weeksAgo(4),
  });

  // Autorizaciones vivas: una activa, una revocada y una caducada. Los tres
  // estados que el guardia de MCP tiene que distinguir.
  await seedMcpAuthorizations(b, [
    {
      mcpClientId: claudeClient.id,
      membershipId: marta.membership.id,
      scopes: ["students:read", "sessions:read", "analytics:read"],
    },
    {
      mcpClientId: chatgptClient.id,
      membershipId: ruben.membership.id,
      scopes: ["students:read"],
      revoked: true,
    },
    {
      mcpClientId: claudeClient.id,
      membershipId: ruben.membership.id,
      scopes: ["analytics:read"],
      expired: true,
    },
  ]);

  /* ── Auditoría ───────────────────────────────────────────────────────── */

  await b.audit({
    action: "student.left",
    entityType: "student_profile",
    entityId: ivan.profile.id,
    actorMembershipId: ruben.membership.id,
    before: { status: "active" },
    after: { status: "left", leftReason: "Cambio de horario laboral" },
    createdAt: weeksAgo(3),
  });
  await b.audit({
    action: "refund.created",
    entityType: "refund",
    actorMembershipId: marta.membership.id,
    after: { amountCents: euros(138), reason: "service_not_provided" },
    createdAt: daysAgo(14),
  });
  await b.audit({
    action: "transcript.blocked",
    entityType: "transcript",
    actorKind: "system",
    after: { reason: "guardian_consent_denied", sessionId: hugoSession.id },
    createdAt: hugoSession.scheduledStart,
  });
  await b.audit({
    action: "students.query",
    entityType: "student_profile",
    actorKind: "mcp",
    actorMembershipId: marta.membership.id,
    after: { query: "alumnos de B1 sin valorar en 3 semanas", results: 1 },
    createdAt: daysAgo(1),
  });
  await b.audit({
    action: "school.application_fee_changed",
    entityType: "school",
    entityId: b.id,
    actorMembershipId: marta.membership.id,
    before: { applicationFeeBps: 0, applicationFeeEnabled: false },
    after: { applicationFeeBps: 200, applicationFeeEnabled: true },
    createdAt: weeksAgo(8),
  });

  /* ── Datos de las olas 2, 3 y 4 ──────────────────────────────────────── */
  //
  // Se siembran ahora para que el desarrollo de esas olas no tenga que esperar
  // a que un cliente real genere el histórico. Sin esto, la analítica no se
  // puede probar y el constructor de webs no se puede construir.

  await seedPlacementBank(b, "es");
  await seedPlacementBank(b, "en");

  await seedSite(b, {
    locales: ["es-ES", "en-GB"],
    published: true,
    theme: { primaryColor: "#13314B", accentColor: "#2B47C4" },
    courseIds: [esB1.id, esA2.id, enB2Biz.id, esC1Dele.id],
    teacherProfileIds: [carla.profile.id, dan.profile.id, sofia.profile.id, marc.profile.id],
  });

  await seedLeads(b, {
    courseIds: [esB1.id, esA2.id, enB2Biz.id],
    convertedStudentProfileId: paula.profile.id,
    assignedToMembershipId: ruben.membership.id,
  });

  // El histórico de encuestas se ancla a sesiones reales (la unicidad es por
  // encuesta + persona + sesión). Se excluyen las de esta semana, que ya
  // tienen sus propias respuestas CSAT sembradas más arriba.
  const thisWeekSessionIds = new Set(thisWeekSessions.map((x) => x.session.id));
  const analyticsSessionIds = (
    await b.db.select({ id: s.sessions.id }).from(s.sessions).where(eq(s.sessions.schoolId, b.id))
  )
    .map((r) => r.id)
    .filter((id) => !thisWeekSessionIds.has(id));

  await seedAnalyticsHistory(b, {
    npsSurveyId: nps.id,
    csatSurveyId: csat.id,
    studentMembershipIds: fillerStudents.map((f) => f.membership.id),
    teacherProfileIds: [carla.profile.id, dan.profile.id, sofia.profile.id, marc.profile.id],
    teacherMembershipIds: [carla.membership.id, dan.membership.id, sofia.membership.id],
    studentProfileIds: fillerStudents.map((f) => f.profile.id),
    sessionIds: analyticsSessionIds,
  });

  return {
    school: b.school,
    teachers: { carla, dan, sofia, yuki, marc, elena },
    students: { lucia, adrian, nerea, tomas, paula, ivan, rocio, nestor, sara, hugo },
    staff: { marta, ruben },
    units: { doctorUnit, marketUnit, uploadedUnit, bizUnit },
    danUserId: dan.userId,
  };
}
