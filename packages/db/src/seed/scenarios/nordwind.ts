/**
 * Escenario 2 — Sprachschule Nordwind (de-DE)
 *
 * La escuela recién registrada: plan Inicial en periodo de prueba, Stripe
 * Connect sin empezar, sin IA. Sirve para probar el estado del producto en
 * el día uno, que es como lo verá cada cliente nuevo.
 *
 * Su otra razón de ser es el alumnado menor de edad. Aquí la mayoría son
 * niños, y eso obliga a que funcione todo lo que cuelga de ahí: tutor legal
 * como pagador, consentimientos firmados por un adulto, retención corta de
 * datos y grabación desactivada por defecto.
 *
 * Casos que cubre:
 *   · escuela en prueba, sin Connect y sin poder cobrar todavía
 *   · comisión de plataforma deshabilitada (0 %)
 *   · alumnado infantil con tutor legal y consentimientos delegados
 *   · un tutor con dos hijos en la escuela
 *   · retención de datos a 30 días
 *   · invitación de profesor pendiente de aceptar
 *   · sin contenido de IA: el plan Inicial no lo incluye
 */
import type { Db } from "../../index.js";
import { SchoolBuilder } from "../builders.js";
import {
  birthDateForAge,
  daysFromNow,
  euros,
  NOW,
  weekSlot,
  weeksAgo,
} from "../helpers.js";
import { DE_A2_SUPERMARKT_EXERCISES } from "../reference.js";

export async function seedNordwind(db: Db, planIds: Map<string, string>) {
  const b = new SchoolBuilder(db, {
    slug: "nordwind",
    name: "Sprachschule Nordwind",
    legalName: "Nordwind Sprachen GmbH",
    taxId: "DE812345678",
    country: "DE",
    defaultLocale: "de-DE",
    supportedLocales: ["de-DE", "en-GB", "es-ES"],
    timezone: "Europe/Berlin",
    currency: "EUR",
    status: "trial",
    planCode: "starter",
    trialEndsAt: daysFromNow(9),
    merchantStatus: "not_started",
    applicationFeeEnabled: false,
    applicationFeeBps: 0,
    aiCreditsBalance: 0,
    videoBetaEnabled: false,
    dataRetentionDays: 30, // política estricta por trabajar con menores
    emailDomain: "nordwind.example",
    branding: { primaryColor: "#1B3A2F" },
  });

  await b.create(planIds.get("starter")!);

  /* ── Personal ────────────────────────────────────────────────────────── */

  const inge = await b.person({
    name: "Inge Brandt",
    role: "owner",
    locale: "de-DE",
    authProvider: "google",
  });

  const lukas = await b.teacher({
    name: "Lukas Hoffmann",
    tier: "professional",
    languages: ["de"],
    hourlyRateCents: euros(24),
    contractedHoursWeek: 16,
    hiredAt: weeksAgo(3),
    isNativeSpeaker: true,
    certifications: ["Goethe-Institut DaF"],
    locale: "de-DE",
  });

  // Profesora invitada que todavía no ha aceptado: estado `invited`.
  await b.person({
    name: "Marta Kowalski",
    role: "teacher",
    locale: "de-DE",
    status: "invited",
  });

  await b.availability(lukas.profile.id, [
    { weekday: 1, from: 15, to: 19 },
    { weekday: 3, from: 15, to: 19 },
    { weekday: 5, from: 15, to: 19 },
  ]);

  /* ── Curso y grupo ───────────────────────────────────────────────────── */

  const deA1Kids = await b.course({
    code: "DE-A1-KIDS",
    language: "de",
    level: "A1",
    modality: "group",
    priceCents: euros(420),
    sessionMinutes: 45, // sesiones más cortas para niños
    maxStudents: 6,
    translations: [
      { locale: "de-DE", name: "Deutsch A1 — Kinder", description: "Spielerischer Einstieg für 8- bis 12-Jährige." },
      { locale: "en-GB", name: "German A1 — children", description: "Playful introduction for ages 8-12." },
      { locale: "es-ES", name: "Alemán A1 — infantil" },
    ],
  });

  const gKids = await b.group({
    courseId: deA1Kids.id,
    teacherProfileId: lukas.profile.id,
    name: "Kinder A1 — Mo & Mi 16:00",
    capacity: 6,
    startsOn: weeksAgo(2),
    status: "running",
  });

  /* ── Alumnado menor y sus tutores ────────────────────────────────────── */

  const kids: Array<{ name: string; age: number; guardian: string; relationship: "mother" | "father" | "legal_guardian" }> = [
    { name: "Jonas Weber", age: 9, guardian: "Sabine Weber", relationship: "mother" },
    { name: "Lena Weber", age: 11, guardian: "Sabine Weber", relationship: "mother" }, // hermana: mismo tutor
    { name: "Emil Fischer", age: 10, guardian: "Thomas Fischer", relationship: "father" },
    { name: "Mia Schulz", age: 8, guardian: "Katrin Schulz", relationship: "legal_guardian" },
  ];

  const created = [];
  const guardianByName = new Map<string, { membership: { id: string }; userId: string }>();

  for (const kid of kids) {
    const student = await b.student({
      name: kid.name,
      dateOfBirth: birthDateForAge(kid.age),
      nativeLanguage: "de",
      targetLanguage: "de",
      currentLevel: "A1",
      targetLevel: "A2",
      joinedAt: weeksAgo(2),
      locale: "de-DE",
    });

    // Si el tutor ya existe (hermanos), se reutiliza su usuario global.
    const existing = guardianByName.get(kid.guardian);
    const g = await b.guardian({
      name: kid.guardian,
      studentProfileId: student.profile.id,
      studentMembershipId: student.membership.id,
      relationship: kid.relationship,
      isBillingContact: true,
      locale: "de-DE",
      email: existing ? undefined : undefined,
    });
    if (!existing) guardianByName.set(kid.guardian, g);

    // Consentimientos: los firma SIEMPRE el tutor, nunca el menor.
    await b.consent({
      subjectMembershipId: student.membership.id,
      kind: "data_processing",
      status: "granted",
      grantedByMembershipId: g.membership.id,
      evidence: "Einwilligungserklärung bei der Anmeldung unterschrieben",
    });
    // Grabación denegada por defecto en la escuela infantil.
    await b.consent({
      subjectMembershipId: student.membership.id,
      kind: "recording",
      status: "denied",
      grantedByMembershipId: g.membership.id,
    });
    await b.consent({
      subjectMembershipId: student.membership.id,
      kind: "image_rights",
      status: kid.name === "Mia Schulz" ? "granted" : "denied",
      grantedByMembershipId: g.membership.id,
    });

    await b.enroll({
      groupId: gKids.id,
      studentProfileId: student.profile.id,
      enrolledAt: weeksAgo(2),
    });

    created.push({ student, guardian: g });
  }

  /* ── Un adulto, para probar la mezcla ────────────────────────────────── */

  const adult = await b.student({
    name: "Robert Neumann",
    dateOfBirth: birthDateForAge(44),
    nativeLanguage: "en",
    targetLanguage: "de",
    currentLevel: "A2",
    joinedAt: weeksAgo(1),
    locale: "en-GB",
  });
  await b.consent({
    subjectMembershipId: adult.membership.id,
    kind: "data_processing",
    status: "granted",
    grantedByMembershipId: adult.membership.id,
  });
  await b.consent({
    subjectMembershipId: adult.membership.id,
    kind: "recording",
    status: "granted",
    grantedByMembershipId: adult.membership.id,
  });
  await b.enroll({ groupId: gKids.id, studentProfileId: adult.profile.id, enrolledAt: weeksAgo(1) });

  /* ── Material propio ─────────────────────────────────────────────────── */
  //
  // El plan Inicial no incluye generación con IA, pero sí permite subir
  // material propio. Lukas sube su cuaderno de siempre, digitalizado: coste
  // de generación cero y ningún crédito consumido.

  const rubrics = await b.rubrics();
  const supermarktUnit = await b.unit({
    courseId: deA1Kids.id,
    code: "DE-A1-U02",
    language: "de",
    level: "A1",
    topic: "Im Supermarkt",
    skills: ["listening", "grammar", "speaking"],
    source: "uploaded",
    status: "published",
    primaryLocale: "de-DE",
    translations: [
      {
        locale: "de-DE",
        title: "Im Supermarkt",
        description: "Einkaufen, Mengen und Preise. Eigenes Material der Schule.",
      },
      { locale: "es-ES", title: "En el supermercado", machineTranslated: true },
    ],
    exercises: DE_A2_SUPERMARKT_EXERCISES,
    rubricIds: { escrita: rubrics.escrita.id, oral: rubrics.oral.id },
    createdByMembershipId: lukas.membership.id,
    reviewedByMembershipId: lukas.membership.id,
    reviewedAt: weeksAgo(2),
    publishedAt: weeksAgo(2),
    createdAt: weeksAgo(2),
    generationCostCents: 0,
    creditsSpent: 0,
    assets: [{ kind: "document", provider: "upload", bytes: 820_000 }],
  });

  /* ── Clases ──────────────────────────────────────────────────────────── */

  for (let week = 2; week >= 0; week--) {
    for (const weekday of [1, 3]) {
      const start = weekSlot(-week, weekday, 16);
      const isPast = start < NOW;
      const session = await b.session({
        groupId: gKids.id,
        teacherProfileId: lukas.profile.id,
        start,
        minutes: 45,
        status: isPast ? "completed" : "scheduled",
        roomProvider: "livekit",
        topic: "Im Supermarkt",
        contentUnitId: supermarktUnit.unit.id,
      });
      if (!isPast) continue;
      for (const { student } of created) {
        await b.attend({
          sessionId: session.id,
          studentProfileId: student.profile.id,
          status: "present",
          source: "auto",
          sessionStart: start,
          minutes: 45,
        });
      }
      await b.attend({
        sessionId: session.id,
        studentProfileId: adult.profile.id,
        status: "present",
        source: "manual",
        sessionStart: start,
        minutes: 45,
        recordedByMembershipId: lukas.membership.id,
      });

      // Toda la clase queda bloqueada para transcribir: hay menores sin permiso.
      await b.transcript({
        sessionId: session.id,
        status: "blocked_no_consent",
        provider: "livekit",
        language: "de",
        blockedReason:
          "Vier minderjährige Teilnehmende ohne Einwilligung zur Aufzeichnung.",
        createdAt: start,
      });
    }
  }

  /* ── Intentos sobre el material propio ───────────────────────────────── */
  //
  // Cubre los tipos que no aparecen en el resto de escenarios: dictado,
  // opción múltiple, ordenar palabras y shadowing.

  const dictation = supermarktUnit.exercises.find((e) => e.type === "dictation")!;
  const multipleChoice = supermarktUnit.exercises.find((e) => e.type === "multiple_choice")!;
  const ordering = supermarktUnit.exercises.find((e) => e.type === "ordering")!;
  const shadowing = supermarktUnit.exercises.find((e) => e.type === "shadowing")!;

  const [jonas, lena, emil] = created;

  await b.attempt({
    exerciseId: dictation.id,
    studentProfileId: jonas!.student.profile.id,
    response: {
      segments: [
        "Ich hätte gern ein Kilo Äpfel.",
        "Wo finde ich die Milch?",
        "Das macht zusammen zwölf Euro.",
        "Brauchen Sie eine Tüte?",
      ],
    },
    status: "ai_graded",
    aiScore: 4,
    aiFeedback: "Alle vier Sätze korrekt.",
    submittedAt: weeksAgo(1),
  });
  await b.attempt({
    exerciseId: multipleChoice.id,
    studentProfileId: lena!.student.profile.id,
    response: { selected: 2 },
    status: "ai_graded",
    aiScore: 0,
    aiFeedback: "«im» ist Dativ. Bei Bewegung braucht man Akkusativ: «in den».",
    submittedAt: weeksAgo(1),
  });
  await b.attempt({
    exerciseId: ordering.id,
    studentProfileId: emil!.student.profile.id,
    response: { order: [1, 3, 0, 5, 4, 2] },
    status: "teacher_validated",
    aiScore: 1,
    teacherScore: 1,
    teacherFeedback: "Sehr gut, die Wortstellung stimmt.",
    validatedByMembershipId: lukas.membership.id,
    submittedAt: weeksAgo(1),
  });
  await b.attempt({
    exerciseId: shadowing.id,
    studentProfileId: jonas!.student.profile.id,
    response: { recordingKey: "nordwind/attempts/shadow-jonas-01", delayMs: 640 },
    status: "submitted",
    submittedAt: weeksAgo(1),
  });

  /* ── Facturación: emitida pero SIN cobrar ────────────────────────────── */
  //
  // Connect no está conectado todavía, así que la escuela puede emitir la
  // factura pero no cobrarla dentro del producto. Es el caso que justifica
  // dejar usar el producto entero antes de conectar Stripe.

  for (const { student, guardian } of created) {
    await b.studentInvoice({
      studentProfileId: student.profile.id,
      billToMembershipId: guardian.membership.id, // la factura va al tutor
      locale: "de-DE",
      lines: [{ description: "Deutsch A1 Kinder — Monatsbeitrag Juli", quantity: 1, unitCents: euros(96), courseId: deA1Kids.id }],
      taxRateBps: 0,
      status: "open",
      issuedOn: weeksAgo(1),
      dueOn: daysFromNow(6),
      // Sin `paymentStatus`: no hay cuenta Connect con la que cobrar.
    });
  }

  await b.audit({
    action: "school.trial_started",
    entityType: "school",
    entityId: b.id,
    actorMembershipId: inge.membership.id,
    after: { plan: "starter", trialDays: 14 },
    createdAt: weeksAgo(2),
  });
  await b.audit({
    action: "connect.onboarding_skipped",
    entityType: "school",
    entityId: b.id,
    actorMembershipId: inge.membership.id,
    after: { reason: "La escuela prefiere probar el producto antes de dar sus datos fiscales" },
    createdAt: weeksAgo(2),
  });

  return { school: b.school, owner: inge, teacher: lukas, students: created, adult };
}
