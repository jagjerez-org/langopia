/**
 * Constructores del seed.
 *
 * `SchoolBuilder` mantiene el estado que de otro modo habría que ir pasando a
 * mano entre llamadas: el id de la escuela, la numeración de facturas y el
 * saldo de créditos. Cada escenario compone sus casos a partir de aquí.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../index.js";
import * as s from "../schema/index.js";
import {
  applicationFee,
  emailFor,
  invoiceNumber,
  isMinor,
  isoDate,
  minutesAfter,
  NOW,
  withTax,
} from "./helpers.js";
import { SPEAKING_RUBRIC, WRITING_RUBRIC, type ExerciseSeed } from "./reference.js";

type Inserted<T> = T extends { $inferSelect: infer U } ? U : never;

export type SchoolSpec = {
  slug: string;
  name: string;
  legalName?: string;
  taxId?: string;
  country: string;
  defaultLocale: string;
  supportedLocales: string[];
  timezone: string;
  currency: string;
  status: (typeof s.schoolStatus.enumValues)[number];
  planCode: string;
  trialEndsAt?: Date | null;
  merchantStatus: (typeof s.merchantStatus.enumValues)[number];
  applicationFeeEnabled: boolean;
  applicationFeeBps: number;
  applicationFeeCapCents?: number | null;
  aiCreditsBalance: number;
  videoBetaEnabled?: boolean;
  dataRetentionDays: number;
  emailDomain: string;
  branding?: { logoUrl?: string; primaryColor?: string; accentColor?: string };
};

export class SchoolBuilder {
  readonly db: Db;
  readonly spec: SchoolSpec;
  school!: Inserted<typeof s.schools>;
  private invoiceSeq = 0;
  private creditBalance = 0;

  constructor(db: Db, spec: SchoolSpec) {
    this.db = db;
    this.spec = spec;
  }

  /* ─── Escuela ────────────────────────────────────────────────────────── */

  async create(planId: string) {
    const [row] = await this.db
      .insert(s.schools)
      .values({
        slug: this.spec.slug,
        name: this.spec.name,
        legalName: this.spec.legalName ?? this.spec.name,
        taxId: this.spec.taxId ?? null,
        country: this.spec.country,
        defaultLocale: this.spec.defaultLocale,
        supportedLocales: this.spec.supportedLocales,
        timezone: this.spec.timezone,
        currency: this.spec.currency,
        status: this.spec.status,
        trialEndsAt: this.spec.trialEndsAt ?? null,
        billingCustomerRef: `cus_seed_${this.spec.slug}`,
        merchantStatus: this.spec.merchantStatus,
        merchantRef:
          this.spec.merchantStatus === "not_started" ? null : `acct_seed_${this.spec.slug}`,
        merchantOnboardedAt: this.spec.merchantStatus === "active" ? NOW : null,
        applicationFeeEnabled: this.spec.applicationFeeEnabled,
        applicationFeeBps: this.spec.applicationFeeBps,
        applicationFeeCapCents: this.spec.applicationFeeCapCents ?? null,
        aiCreditsBalance: 0, // lo fija el libro mayor, no un valor suelto
        videoBetaEnabled: this.spec.videoBetaEnabled ?? false,
        branding: this.spec.branding ?? {},
        dataRetentionDays: this.spec.dataRetentionDays,
      })
      .returning();
    if (!row) throw new Error(`No se pudo crear la escuela ${this.spec.slug}`);
    this.school = row;

    const periodStart = new Date(NOW);
    periodStart.setDate(1);
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.db.insert(s.subscriptions).values({
      schoolId: row.id,
      planId,
      providerRef: `sub_seed_${this.spec.slug}`,
      status: this.spec.status === "past_due" ? "past_due" : "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });

    return row;
  }

  get id() {
    return this.school.id;
  }

  async addDomain(hostname: string, isPrimary = true, verified = true) {
    const [row] = await this.db
      .insert(s.schoolDomains)
      .values({
        schoolId: this.id,
        hostname,
        isPrimary,
        verifiedAt: verified ? NOW : null,
      })
      .returning();
    return row!;
  }

  /* ─── Personas ───────────────────────────────────────────────────────── */

  /**
   * Crea usuario + membresía.
   *
   * Reutiliza en dos niveles distintos:
   *
   *   · El USUARIO, si ya existe con ese correo. Es el caso de una persona que
   *     da clase en dos escuelas: un solo `users.id`, dos membresías.
   *
   *   · La MEMBRESÍA, si esa persona ya tiene ese rol en esta escuela. Es el
   *     caso del tutor con dos hijos matriculados: una sola membresía de
   *     `guardian`, y dos filas en `guardians`. El índice único
   *     (school_id, user_id, role) lo exige, y hace bien: la membresía dice
   *     «quién eres aquí», no «a quién representas».
   */
  async person(opts: {
    name: string;
    role: (typeof s.membershipRole.enumValues)[number];
    email?: string;
    locale?: string;
    timezone?: string;
    authProvider?: string;
    status?: (typeof s.membershipStatus.enumValues)[number];
    reuseUserId?: string;
  }) {
    let userId = opts.reuseUserId;

    if (!userId) {
      const email = opts.email ?? emailFor(opts.name, this.spec.emailDomain);
      const existing = await this.db
        .select()
        .from(s.users)
        .where(sql`lower(${s.users.email}) = lower(${email})`)
        .limit(1);

      if (existing[0]) {
        userId = existing[0].id;
      } else {
        const [user] = await this.db
          .insert(s.users)
          .values({
            email,
            emailVerifiedAt: NOW,
            name: opts.name,
            locale: opts.locale ?? this.spec.defaultLocale,
            timezone: opts.timezone ?? this.spec.timezone,
            authProvider: opts.authProvider ?? "password",
            lastSeenAt: NOW,
          })
          .returning();
        userId = user!.id;
      }
    }

    const existingMembership = await this.db
      .select()
      .from(s.memberships)
      .where(
        and(
          eq(s.memberships.schoolId, this.id),
          eq(s.memberships.userId, userId),
          eq(s.memberships.role, opts.role),
        ),
      )
      .limit(1);

    if (existingMembership[0]) {
      return { userId, membership: existingMembership[0] };
    }

    const [membership] = await this.db
      .insert(s.memberships)
      .values({
        schoolId: this.id,
        userId,
        role: opts.role,
        status: opts.status ?? "active",
        locale: opts.locale ?? null,
      })
      .returning();

    return { userId, membership: membership! };
  }

  async teacher(opts: {
    name: string;
    tier: (typeof s.teacherTier.enumValues)[number];
    languages: string[];
    hourlyRateCents: number;
    contractedHoursWeek: number;
    hiredAt: Date;
    locale?: string;
    isNativeSpeaker?: boolean;
    certifications?: string[];
    bio?: string;
    status?: (typeof s.teacherStatus.enumValues)[number];
    leftAt?: Date | null;
    leftReason?: string;
    reuseUserId?: string;
    email?: string;
  }) {
    const { userId, membership } = await this.person({
      name: opts.name,
      role: "teacher",
      locale: opts.locale,
      status: opts.status === "left" ? "left" : "active",
      reuseUserId: opts.reuseUserId,
      email: opts.email,
    });

    const [profile] = await this.db
      .insert(s.teacherProfiles)
      .values({
        schoolId: this.id,
        membershipId: membership.id,
        tier: opts.tier,
        bio: opts.bio ?? null,
        languages: opts.languages,
        certifications: opts.certifications ?? [],
        isNativeSpeaker: opts.isNativeSpeaker ?? false,
        hourlyRateCents: opts.hourlyRateCents,
        currency: this.spec.currency,
        contractedHoursWeek: opts.contractedHoursWeek,
        status: opts.status ?? "active",
        hiredAt: isoDate(opts.hiredAt),
        leftAt: opts.leftAt ?? null,
        leftReason: opts.leftReason ?? null,
      })
      .returning();

    return { userId, membership, profile: profile! };
  }

  async availability(
    teacherProfileId: string,
    slots: Array<{ weekday: number; from: number; to: number }>,
  ) {
    if (slots.length === 0) return;
    await this.db.insert(s.teacherAvailability).values(
      slots.map((slot) => ({
        schoolId: this.id,
        teacherProfileId,
        weekday: slot.weekday,
        startMinute: slot.from * 60,
        endMinute: slot.to * 60,
      })),
    );
  }

  /**
   * Crea un alumno. Si es menor, `guardianRequired` se calcula de la fecha de
   * nacimiento —no se confía en que quien escribe el seed lo marque a mano.
   */
  async student(opts: {
    name: string;
    dateOfBirth: string;
    nativeLanguage: string;
    targetLanguage: string;
    currentLevel?: (typeof s.cefrLevel.enumValues)[number];
    targetLevel?: (typeof s.cefrLevel.enumValues)[number];
    goals?: string;
    status?: (typeof s.studentStatus.enumValues)[number];
    joinedAt: Date;
    leftAt?: Date | null;
    leftReason?: string;
    pausedUntil?: Date | null;
    locale?: string;
    email?: string;
    reuseUserId?: string;
  }) {
    const minor = isMinor(opts.dateOfBirth);
    const { userId, membership } = await this.person({
      name: opts.name,
      role: "student",
      locale: opts.locale,
      status: opts.status === "left" ? "left" : "active",
      email: opts.email,
      reuseUserId: opts.reuseUserId,
    });

    const [profile] = await this.db
      .insert(s.studentProfiles)
      .values({
        schoolId: this.id,
        membershipId: membership.id,
        dateOfBirth: opts.dateOfBirth,
        guardianRequired: minor,
        nativeLanguage: opts.nativeLanguage,
        targetLanguage: opts.targetLanguage,
        currentLevel: opts.currentLevel ?? null,
        targetLevel: opts.targetLevel ?? null,
        goals: opts.goals ?? null,
        status: opts.status ?? "active",
        joinedAt: opts.joinedAt,
        pausedUntil: opts.pausedUntil ? isoDate(opts.pausedUntil) : null,
        leftAt: opts.leftAt ?? null,
        leftReason: opts.leftReason ?? null,
      })
      .returning();

    return { userId, membership, profile: profile!, isMinor: minor };
  }

  /** Da de alta al tutor legal de un alumno menor y lo pone como pagador. */
  async guardian(opts: {
    name: string;
    studentProfileId: string;
    studentMembershipId: string;
    relationship: (typeof s.guardianRelationship.enumValues)[number];
    locale?: string;
    email?: string;
    isBillingContact?: boolean;
  }) {
    const { userId, membership } = await this.person({
      name: opts.name,
      role: "guardian",
      locale: opts.locale,
      email: opts.email,
    });

    const [guardian] = await this.db
      .insert(s.guardians)
      .values({
        schoolId: this.id,
        studentProfileId: opts.studentProfileId,
        membershipId: membership.id,
        relationship: opts.relationship,
        isBillingContact: opts.isBillingContact ?? true,
        canGiveConsent: true,
      })
      .returning();

    if (opts.isBillingContact ?? true) {
      await this.db
        .update(s.studentProfiles)
        .set({ billingContactMembershipId: membership.id })
        .where(eq(s.studentProfiles.id, opts.studentProfileId));
    }

    return { userId, membership, guardian: guardian! };
  }

  /**
   * Registra un consentimiento. Para un menor, `grantedBy` debe ser el tutor:
   * es lo que se comprueba antes de encender una grabación.
   */
  async consent(opts: {
    subjectMembershipId: string;
    kind: (typeof s.consentKind.enumValues)[number];
    status: (typeof s.consentStatus.enumValues)[number];
    grantedByMembershipId?: string;
    grantedAt?: Date | null;
    withdrawnAt?: Date | null;
    policyVersion?: string;
    evidence?: string;
  }) {
    const [row] = await this.db
      .insert(s.consents)
      .values({
        schoolId: this.id,
        subjectMembershipId: opts.subjectMembershipId,
        kind: opts.kind,
        status: opts.status,
        grantedByMembershipId: opts.grantedByMembershipId ?? null,
        grantedAt: opts.status === "granted" ? (opts.grantedAt ?? NOW) : null,
        withdrawnAt: opts.withdrawnAt ?? null,
        policyVersion: opts.policyVersion ?? "1.0",
        evidence: opts.evidence ?? null,
      })
      .returning();
    return row!;
  }

  /* ─── Catálogo ───────────────────────────────────────────────────────── */

  async course(opts: {
    code: string;
    language: string;
    level: (typeof s.cefrLevel.enumValues)[number];
    modality: (typeof s.courseModality.enumValues)[number];
    priceCents: number;
    totalSessions?: number;
    sessionMinutes?: number;
    maxStudents?: number;
    translations: Array<{ locale: string; name: string; description?: string }>;
  }) {
    const [course] = await this.db
      .insert(s.courses)
      .values({
        schoolId: this.id,
        code: opts.code,
        language: opts.language,
        level: opts.level,
        modality: opts.modality,
        totalSessions: opts.totalSessions ?? 50,
        sessionMinutes: opts.sessionMinutes ?? 60,
        maxStudents: opts.maxStudents ?? (opts.modality === "private" ? 1 : 5),
        priceCents: opts.priceCents,
        currency: this.spec.currency,
        isActive: true,
      })
      .returning();

    await this.db.insert(s.courseTranslations).values(
      opts.translations.map((t) => ({
        schoolId: this.id,
        courseId: course!.id,
        locale: t.locale,
        name: t.name,
        description: t.description ?? null,
      })),
    );

    return course!;
  }

  async group(opts: {
    courseId: string;
    teacherProfileId: string | null;
    name: string;
    capacity?: number;
    startsOn: Date;
    endsOn?: Date | null;
    status: (typeof s.groupStatus.enumValues)[number];
  }) {
    const [row] = await this.db
      .insert(s.groups)
      .values({
        schoolId: this.id,
        courseId: opts.courseId,
        teacherProfileId: opts.teacherProfileId,
        name: opts.name,
        capacity: opts.capacity ?? 5,
        startsOn: isoDate(opts.startsOn),
        endsOn: opts.endsOn ? isoDate(opts.endsOn) : null,
        status: opts.status,
      })
      .returning();
    return row!;
  }

  async enroll(opts: {
    groupId: string;
    studentProfileId: string;
    status?: (typeof s.enrollmentStatus.enumValues)[number];
    agreedPriceCents?: number;
    enrolledAt: Date;
    endedAt?: Date | null;
    endedReason?: string;
  }) {
    const [row] = await this.db
      .insert(s.enrollments)
      .values({
        schoolId: this.id,
        groupId: opts.groupId,
        studentProfileId: opts.studentProfileId,
        status: opts.status ?? "active",
        agreedPriceCents: opts.agreedPriceCents ?? null,
        enrolledAt: opts.enrolledAt,
        endedAt: opts.endedAt ?? null,
        endedReason: opts.endedReason ?? null,
      })
      .returning();
    return row!;
  }

  /* ─── Clases ─────────────────────────────────────────────────────────── */

  async recurrence(opts: { groupId: string; rrule: string; startsAt: Date; until?: Date }) {
    const [row] = await this.db
      .insert(s.sessionRecurrences)
      .values({
        schoolId: this.id,
        groupId: opts.groupId,
        rrule: opts.rrule,
        timezone: this.spec.timezone,
        startsAt: opts.startsAt,
        until: opts.until ?? null,
      })
      .returning();
    return row!;
  }

  async session(opts: {
    groupId: string;
    teacherProfileId: string | null;
    start: Date;
    minutes: number;
    status: (typeof s.sessionStatus.enumValues)[number];
    roomProvider: (typeof s.roomProvider.enumValues)[number];
    topic?: string;
    contentUnitId?: string | null;
    recurrenceId?: string | null;
    canceledAt?: Date | null;
    canceledByMembershipId?: string | null;
    cancelReason?: string;
    cancelNoticeHours?: number;
    rescheduledFromSessionId?: string | null;
    actualStart?: Date | null;
    actualEnd?: Date | null;
  }) {
    const end = minutesAfter(opts.start, opts.minutes);
    const roomUrl = {
      livekit: `https://aula.langopia.app/${this.spec.slug}/${Math.abs(opts.start.getTime() % 1e7)}`,
      zoom: "https://zoom.us/j/98123456789",
      google_meet: "https://meet.google.com/abc-defg-hij",
      ms_teams: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_seed",
      in_person: null,
    }[opts.roomProvider];

    const [row] = await this.db
      .insert(s.sessions)
      .values({
        schoolId: this.id,
        groupId: opts.groupId,
        teacherProfileId: opts.teacherProfileId,
        recurrenceId: opts.recurrenceId ?? null,
        scheduledStart: opts.start,
        scheduledEnd: end,
        actualStart: opts.actualStart ?? (opts.status === "completed" ? opts.start : null),
        actualEnd: opts.actualEnd ?? (opts.status === "completed" ? end : null),
        status: opts.status,
        topic: opts.topic ?? null,
        contentUnitId: opts.contentUnitId ?? null,
        roomProvider: opts.roomProvider,
        roomUrl,
        roomExternalId: opts.roomProvider === "livekit" ? null : `ext_${opts.start.getTime()}`,
        canceledAt: opts.canceledAt ?? null,
        canceledByMembershipId: opts.canceledByMembershipId ?? null,
        cancelReason: opts.cancelReason ?? null,
        cancelNoticeHours: opts.cancelNoticeHours ?? null,
        rescheduledFromSessionId: opts.rescheduledFromSessionId ?? null,
      })
      .returning();
    return row!;
  }

  async attend(opts: {
    sessionId: string;
    studentProfileId: string;
    status: (typeof s.attendanceStatus.enumValues)[number];
    source: (typeof s.attendanceSource.enumValues)[number];
    sessionStart: Date;
    minutes?: number;
    note?: string;
    recordedByMembershipId?: string | null;
  }) {
    const present = opts.status === "present" || opts.status === "late";
    const joinedAt = present
      ? minutesAfter(opts.sessionStart, opts.status === "late" ? 9 : 0)
      : null;
    const [row] = await this.db
      .insert(s.attendance)
      .values({
        schoolId: this.id,
        sessionId: opts.sessionId,
        studentProfileId: opts.studentProfileId,
        status: opts.status,
        source: opts.source,
        joinedAt,
        leftAt: joinedAt ? minutesAfter(joinedAt, opts.minutes ?? 60) : null,
        minutesPresent: present ? (opts.minutes ?? 60) : 0,
        note: opts.note ?? null,
        recordedByMembershipId: opts.recordedByMembershipId ?? null,
      })
      .returning();
    return row!;
  }

  /* ─── Contenido ──────────────────────────────────────────────────────── */

  async rubrics() {
    const rows = await this.db
      .insert(s.rubrics)
      .values([
        {
          schoolId: this.id,
          code: WRITING_RUBRIC.code,
          name: WRITING_RUBRIC.name,
          maxScore: WRITING_RUBRIC.maxScore,
          criteria: WRITING_RUBRIC.criteria,
        },
        {
          schoolId: this.id,
          code: SPEAKING_RUBRIC.code,
          name: SPEAKING_RUBRIC.name,
          maxScore: SPEAKING_RUBRIC.maxScore,
          criteria: SPEAKING_RUBRIC.criteria,
        },
      ])
      .returning();
    return {
      escrita: rows.find((r) => r.code === WRITING_RUBRIC.code)!,
      oral: rows.find((r) => r.code === SPEAKING_RUBRIC.code)!,
    };
  }

  /**
   * Crea una unidad con sus traducciones, sus recursos y sus ejercicios, y
   * anota el consumo de créditos en el libro mayor.
   */
  async unit(opts: {
    courseId: string | null;
    code: string;
    language: string;
    level: (typeof s.cefrLevel.enumValues)[number];
    topic: string;
    skills: Array<(typeof s.languageSkill.enumValues)[number]>;
    source: (typeof s.contentSource.enumValues)[number];
    status: (typeof s.contentStatus.enumValues)[number];
    primaryLocale: string;
    translations: Array<{
      locale: string;
      title: string;
      description?: string;
      body?: string;
      machineTranslated?: boolean;
    }>;
    exercises: ExerciseSeed[];
    rubricIds: { escrita: string; oral: string };
    createdByMembershipId: string;
    reviewedByMembershipId?: string | null;
    reviewedAt?: Date | null;
    publishedAt?: Date | null;
    createdAt: Date;
    generationCostCents: number;
    creditsSpent: number;
    assets?: Array<{
      kind: (typeof s.assetKind.enumValues)[number];
      provider: string;
      durationMs?: number;
      bytes?: number;
      isBeta?: boolean;
      altText?: Record<string, string>;
    }>;
  }) {
    const [unit] = await this.db
      .insert(s.contentUnits)
      .values({
        schoolId: this.id,
        courseId: opts.courseId,
        code: opts.code,
        language: opts.language,
        level: opts.level,
        skills: opts.skills,
        topic: opts.topic,
        source: opts.source,
        status: opts.status,
        primaryLocale: opts.primaryLocale,
        generationCostCents: opts.generationCostCents,
        creditsSpent: opts.creditsSpent,
        createdByMembershipId: opts.createdByMembershipId,
        reviewedByMembershipId: opts.reviewedByMembershipId ?? null,
        reviewedAt: opts.reviewedAt ?? null,
        publishedAt: opts.publishedAt ?? null,
        createdAt: opts.createdAt,
      })
      .returning();

    await this.db.insert(s.contentUnitTranslations).values(
      opts.translations.map((t) => ({
        schoolId: this.id,
        contentUnitId: unit!.id,
        locale: t.locale,
        title: t.title,
        description: t.description ?? null,
        body: t.body ?? null,
        machineTranslated: t.machineTranslated ?? false,
      })),
    );

    if (opts.assets?.length) {
      await this.db.insert(s.contentAssets).values(
        opts.assets.map((a, i) => ({
          schoolId: this.id,
          contentUnitId: unit!.id,
          kind: a.kind,
          storageKey: `${this.spec.slug}/units/${opts.code}/${a.kind}-${i + 1}`,
          mimeType:
            a.kind === "audio"
              ? "audio/mpeg"
              : a.kind === "image"
                ? "image/webp"
                : a.kind === "video"
                  ? "video/mp4"
                  : "application/pdf",
          bytes: a.bytes ?? 240_000,
          durationMs: a.durationMs ?? null,
          provider: a.provider,
          isBeta: a.isBeta ?? false,
          altText: a.altText ?? {},
        })),
      );
    }

    const exercises: Inserted<typeof s.exercises>[] = [];
    for (const [i, ex] of opts.exercises.entries()) {
      const [row] = await this.db
        .insert(s.exercises)
        .values({
          schoolId: this.id,
          contentUnitId: unit!.id,
          position: i + 1,
          type: ex.type,
          skill: ex.skill,
          level: opts.level,
          prompt: ex.prompt,
          solution: ex.solution ?? null,
          rubricId: ex.rubric ? opts.rubricIds[ex.rubric] : null,
          maxScore: ex.maxScore,
          maxAttempts: 3,
          srsEnabled: ex.srsEnabled,
          requiresTeacherValidation: ex.requiresTeacherValidation,
        })
        .returning();
      exercises.push(row!);

      const entries = Object.entries(ex.instructions);
      if (entries.length > 0) {
        await this.db.insert(s.exerciseTranslations).values(
          entries.map(([locale, instructions]) => ({
            schoolId: this.id,
            exerciseId: row!.id,
            locale,
            instructions,
            machineTranslated: locale !== opts.primaryLocale,
          })),
        );
      }
    }

    if (opts.creditsSpent > 0) {
      await this.spendCredits({
        credits: opts.creditsSpent,
        costCents: opts.generationCostCents,
        note: `Unidad ${opts.code}`,
        createdAt: opts.createdAt,
      });
    }

    return { unit: unit!, exercises };
  }

  /**
   * Tarjeta de repaso espaciado.
   *
   * Se crea cuando un alumno falla un ejercicio con `srsEnabled`. Los
   * parámetros siguen SM-2: cada acierto alarga el intervalo, cada fallo lo
   * reinicia y baja la facilidad, con suelo en 1,3.
   */
  async srsCard(opts: {
    studentProfileId: string;
    exerciseId: string;
    ease?: number;
    intervalDays?: number;
    repetitions?: number;
    lapses?: number;
    dueOn: Date;
    lastReviewedAt?: Date | null;
  }) {
    const [row] = await this.db
      .insert(s.srsCards)
      .values({
        schoolId: this.id,
        studentProfileId: opts.studentProfileId,
        exerciseId: opts.exerciseId,
        ease: opts.ease ?? 2.5,
        intervalDays: opts.intervalDays ?? 1,
        repetitions: opts.repetitions ?? 0,
        lapses: opts.lapses ?? 0,
        dueOn: isoDate(opts.dueOn),
        lastReviewedAt: opts.lastReviewedAt ?? null,
      })
      .returning();
    return row!;
  }

  /* ─── Evaluación ─────────────────────────────────────────────────────── */

  async attempt(opts: {
    exerciseId: string;
    studentProfileId: string;
    sessionId?: string | null;
    assessmentId?: string | null;
    response: Record<string, unknown>;
    status: (typeof s.attemptStatus.enumValues)[number];
    aiScore?: number | null;
    aiFeedback?: string;
    aiRubricScores?: Record<string, number>;
    teacherScore?: number | null;
    teacherFeedback?: string;
    validatedByMembershipId?: string | null;
    submittedAt: Date;
    attemptNumber?: number;
    durationMs?: number;
  }) {
    const [row] = await this.db
      .insert(s.attempts)
      .values({
        schoolId: this.id,
        exerciseId: opts.exerciseId,
        studentProfileId: opts.studentProfileId,
        sessionId: opts.sessionId ?? null,
        assessmentId: opts.assessmentId ?? null,
        attemptNumber: opts.attemptNumber ?? 1,
        response: opts.response,
        status: opts.status,
        aiScore: opts.aiScore ?? null,
        aiFeedback: opts.aiFeedback ?? null,
        aiRubricScores: opts.aiRubricScores ?? null,
        aiModel: opts.aiScore != null ? "claude-opus-5" : null,
        aiCostCents: opts.aiScore != null ? 3 : 0,
        teacherScore: opts.teacherScore ?? null,
        teacherFeedback: opts.teacherFeedback ?? null,
        validatedByMembershipId: opts.validatedByMembershipId ?? null,
        validatedAt: opts.validatedByMembershipId ? opts.submittedAt : null,
        submittedAt: opts.submittedAt,
        durationMs: opts.durationMs ?? 180_000,
      })
      .returning();
    return row!;
  }

  async assessment(opts: {
    kind: (typeof s.assessmentKind.enumValues)[number];
    studentProfileId: string;
    courseId?: string | null;
    contentUnitId?: string | null;
    title: string;
    language: string;
    levelBefore?: (typeof s.cefrLevel.enumValues)[number] | null;
    levelResult?: (typeof s.cefrLevel.enumValues)[number] | null;
    score?: number | null;
    maxScore?: number | null;
    skillBreakdown?: Record<string, number>;
    status: (typeof s.assessmentStatus.enumValues)[number];
    scheduledFor?: Date | null;
    submittedAt?: Date | null;
    gradedAt?: Date | null;
    validatedByMembershipId?: string | null;
  }) {
    const [row] = await this.db
      .insert(s.assessments)
      .values({
        schoolId: this.id,
        kind: opts.kind,
        studentProfileId: opts.studentProfileId,
        courseId: opts.courseId ?? null,
        contentUnitId: opts.contentUnitId ?? null,
        title: opts.title,
        language: opts.language,
        levelBefore: opts.levelBefore ?? null,
        levelResult: opts.levelResult ?? null,
        score: opts.score ?? null,
        maxScore: opts.maxScore ?? null,
        skillBreakdown: opts.skillBreakdown ?? null,
        status: opts.status,
        scheduledFor: opts.scheduledFor ?? null,
        submittedAt: opts.submittedAt ?? null,
        gradedAt: opts.gradedAt ?? null,
        validatedByMembershipId: opts.validatedByMembershipId ?? null,
        validatedAt: opts.validatedByMembershipId ? (opts.gradedAt ?? NOW) : null,
      })
      .returning();
    return row!;
  }

  async evaluation(opts: {
    teacherProfileId: string;
    studentProfileId: string;
    periodStart: Date;
    periodEnd: Date;
    progressRating: number;
    levelAtEvaluation?: (typeof s.cefrLevel.enumValues)[number] | null;
    strengths?: string;
    improvements?: string;
    nextSteps?: string;
    visibleToGuardian?: boolean;
    createdAt: Date;
  }) {
    const [row] = await this.db
      .insert(s.evaluations)
      .values({
        schoolId: this.id,
        teacherProfileId: opts.teacherProfileId,
        studentProfileId: opts.studentProfileId,
        periodStart: isoDate(opts.periodStart),
        periodEnd: isoDate(opts.periodEnd),
        progressRating: opts.progressRating,
        levelAtEvaluation: opts.levelAtEvaluation ?? null,
        strengths: opts.strengths ?? null,
        improvements: opts.improvements ?? null,
        nextSteps: opts.nextSteps ?? null,
        visibleToStudent: true,
        visibleToGuardian: opts.visibleToGuardian ?? true,
        createdAt: opts.createdAt,
      })
      .returning();
    return row!;
  }

  /* ─── Satisfacción ───────────────────────────────────────────────────── */

  async survey(opts: {
    kind: (typeof s.surveyKind.enumValues)[number];
    code: string;
    name: string;
    audience: (typeof s.respondentKind.enumValues)[number];
    autoSendAfterSession?: boolean;
  }) {
    const [row] = await this.db
      .insert(s.surveys)
      .values({
        schoolId: this.id,
        kind: opts.kind,
        code: opts.code,
        name: opts.name,
        audience: opts.audience,
        autoSendAfterSession: opts.autoSendAfterSession ?? false,
        isActive: true,
      })
      .returning();
    return row!;
  }

  async surveyResponse(opts: {
    surveyId: string;
    respondentMembershipId: string;
    respondentKind: (typeof s.respondentKind.enumValues)[number];
    score: number;
    comment?: string;
    sessionId?: string | null;
    teacherProfileId?: string | null;
    submittedAt: Date;
  }) {
    const [row] = await this.db
      .insert(s.surveyResponses)
      .values({
        schoolId: this.id,
        surveyId: opts.surveyId,
        respondentMembershipId: opts.respondentMembershipId,
        respondentKind: opts.respondentKind,
        sessionId: opts.sessionId ?? null,
        teacherProfileId: opts.teacherProfileId ?? null,
        score: opts.score,
        comment: opts.comment ?? null,
        submittedAt: opts.submittedAt,
      })
      .returning();
    return row!;
  }

  async review(opts: {
    authorMembershipId: string;
    subject: (typeof s.reviewSubject.enumValues)[number];
    rating: number;
    comment: string;
    contentUnitId?: string | null;
    sessionId?: string | null;
    teacherProfileId?: string | null;
    createdAt: Date;
    acknowledgedByMembershipId?: string | null;
  }) {
    const [row] = await this.db
      .insert(s.reviews)
      .values({
        schoolId: this.id,
        authorMembershipId: opts.authorMembershipId,
        subject: opts.subject,
        contentUnitId: opts.contentUnitId ?? null,
        sessionId: opts.sessionId ?? null,
        teacherProfileId: opts.teacherProfileId ?? null,
        rating: opts.rating,
        comment: opts.comment,
        acknowledgedAt: opts.acknowledgedByMembershipId ? NOW : null,
        acknowledgedByMembershipId: opts.acknowledgedByMembershipId ?? null,
        createdAt: opts.createdAt,
      })
      .returning();
    return row!;
  }

  /* ─── Facturación ────────────────────────────────────────────────────── */

  /**
   * Emite una factura de la escuela a un alumno, con su cobro y, si procede,
   * su devolución. La comisión se calcula con los valores de la escuela en
   * este momento y se congela en la fila.
   */
  async studentInvoice(opts: {
    studentProfileId: string;
    billToMembershipId: string;
    locale: string;
    lines: Array<{
      description: string;
      quantity: number;
      unitCents: number;
      courseId?: string | null;
      sessionId?: string | null;
    }>;
    taxRateBps: number;
    status: (typeof s.invoiceStatus.enumValues)[number];
    issuedOn: Date;
    dueOn: Date;
    paidAt?: Date | null;
    paymentStatus?: (typeof s.paymentStatus.enumValues)[number];
    paymentMethod?: (typeof s.paymentMethod.enumValues)[number];
    failureCode?: string;
    failureMessage?: string;
    refund?: {
      amountCents: number;
      reason: (typeof s.refundReason.enumValues)[number];
      status: (typeof s.refundStatus.enumValues)[number];
      reversesApplicationFee: boolean;
      note?: string;
      requestedByMembershipId?: string;
      createdAt: Date;
    };
  }) {
    const subtotal = opts.lines.reduce((sum, l) => sum + l.quantity * l.unitCents, 0);
    const amounts = withTax(subtotal, opts.taxRateBps);

    const feeBps = this.school.applicationFeeEnabled ? this.school.applicationFeeBps : 0;
    const feeCents = applicationFee(
      amounts.totalCents,
      feeBps,
      this.school.applicationFeeCapCents,
    );

    this.invoiceSeq += 1;
    const [invoice] = await this.db
      .insert(s.invoices)
      .values({
        schoolId: this.id,
        direction: "school_to_student",
        studentProfileId: opts.studentProfileId,
        billToMembershipId: opts.billToMembershipId,
        number: invoiceNumber(opts.issuedOn.getFullYear(), this.invoiceSeq),
        status: opts.status,
        currency: this.spec.currency,
        locale: opts.locale,
        subtotalCents: amounts.subtotalCents,
        taxCents: amounts.taxCents,
        taxRateBps: opts.taxRateBps,
        totalCents: amounts.totalCents,
        applicationFeeBps: feeBps,
        applicationFeeCents: feeCents,
        issuedOn: isoDate(opts.issuedOn),
        dueOn: isoDate(opts.dueOn),
        paidAt: opts.paidAt ?? null,
        providerRef: `in_seed_${this.spec.slug}_${this.invoiceSeq}`,
      })
      .returning();

    await this.db.insert(s.invoiceLines).values(
      opts.lines.map((l, i) => ({
        schoolId: this.id,
        invoiceId: invoice!.id,
        description: l.description,
        quantity: l.quantity,
        unitCents: l.unitCents,
        totalCents: l.quantity * l.unitCents,
        courseId: l.courseId ?? null,
        sessionId: l.sessionId ?? null,
        position: i + 1,
      })),
    );

    let payment: Inserted<typeof s.payments> | null = null;
    if (opts.paymentStatus) {
      const [row] = await this.db
        .insert(s.payments)
        .values({
          schoolId: this.id,
          invoiceId: invoice!.id,
          status: opts.paymentStatus,
          method: opts.paymentMethod ?? "card",
          amountCents: amounts.totalCents,
          currency: this.spec.currency,
          applicationFeeCents: opts.paymentStatus === "succeeded" ? feeCents : 0,
          provider: "stripe",
          providerRef: `pi_seed_${this.spec.slug}_${this.invoiceSeq}`,
          merchantRef: this.school.merchantRef,
          paidAt: opts.paidAt ?? null,
          failureCode: opts.failureCode ?? null,
          failureMessage: opts.failureMessage ?? null,
        })
        .returning();
      payment = row!;
    }

    let refund: Inserted<typeof s.refunds> | null = null;
    if (opts.refund && payment) {
      const feeReversed = opts.refund.reversesApplicationFee
        ? Math.round((feeCents * opts.refund.amountCents) / amounts.totalCents)
        : 0;
      const [row] = await this.db
        .insert(s.refunds)
        .values({
          schoolId: this.id,
          paymentId: payment.id,
          amountCents: opts.refund.amountCents,
          currency: this.spec.currency,
          reason: opts.refund.reason,
          status: opts.refund.status,
          reversesApplicationFee: opts.refund.reversesApplicationFee,
          applicationFeeReversedCents: feeReversed,
          providerRef: `re_seed_${this.spec.slug}_${this.invoiceSeq}`,
          requestedByMembershipId: opts.refund.requestedByMembershipId ?? null,
          note: opts.refund.note ?? null,
          createdAt: opts.refund.createdAt,
          processedAt: opts.refund.status === "succeeded" ? opts.refund.createdAt : null,
        })
        .returning();
      refund = row!;

      await this.db
        .update(s.payments)
        .set({
          status:
            opts.refund.amountCents >= amounts.totalCents ? "refunded" : "partially_refunded",
        })
        .where(eq(s.payments.id, payment.id));
    }

    return { invoice: invoice!, payment, refund };
  }

  /** Factura tuya a la escuela: la suscripción. Nunca lleva comisión. */
  async platformInvoice(opts: {
    planName: string;
    priceCents: number;
    status: (typeof s.invoiceStatus.enumValues)[number];
    issuedOn: Date;
    paidAt?: Date | null;
  }) {
    this.invoiceSeq += 1;
    const amounts = withTax(opts.priceCents, 2100);
    const [invoice] = await this.db
      .insert(s.invoices)
      .values({
        schoolId: this.id,
        direction: "platform_to_school",
        number: `LGP-${invoiceNumber(opts.issuedOn.getFullYear(), this.invoiceSeq)}`,
        status: opts.status,
        currency: "EUR",
        locale: this.spec.defaultLocale,
        subtotalCents: amounts.subtotalCents,
        taxCents: amounts.taxCents,
        taxRateBps: 2100,
        totalCents: amounts.totalCents,
        applicationFeeBps: 0,
        applicationFeeCents: 0,
        issuedOn: isoDate(opts.issuedOn),
        dueOn: isoDate(opts.issuedOn),
        paidAt: opts.paidAt ?? null,
        providerRef: `in_seed_platform_${this.spec.slug}_${this.invoiceSeq}`,
      })
      .returning();

    await this.db.insert(s.invoiceLines).values({
      schoolId: this.id,
      invoiceId: invoice!.id,
      description: `Suscripción Langopia — plan ${opts.planName}`,
      quantity: 1,
      unitCents: opts.priceCents,
      totalCents: opts.priceCents,
      position: 1,
    });

    return invoice!;
  }

  /* ─── Créditos de IA ─────────────────────────────────────────────────── */

  async grantCredits(opts: {
    credits: number;
    reason: (typeof s.creditReason.enumValues)[number];
    note: string;
    createdAt?: Date;
  }) {
    this.creditBalance += opts.credits;
    const [row] = await this.db
      .insert(s.creditLedger)
      .values({
        schoolId: this.id,
        delta: opts.credits,
        balanceAfter: this.creditBalance,
        reason: opts.reason,
        costCents: 0,
        note: opts.note,
        createdAt: opts.createdAt ?? NOW,
      })
      .returning();
    await this.syncCreditBalance();
    return row!;
  }

  async spendCredits(opts: {
    credits: number;
    costCents: number;
    note: string;
    createdAt?: Date;
  }) {
    this.creditBalance -= opts.credits;
    const [row] = await this.db
      .insert(s.creditLedger)
      .values({
        schoolId: this.id,
        delta: -opts.credits,
        balanceAfter: this.creditBalance,
        reason: "generation",
        costCents: opts.costCents,
        note: opts.note,
        createdAt: opts.createdAt ?? NOW,
      })
      .returning();
    await this.syncCreditBalance();
    return row!;
  }

  private async syncCreditBalance() {
    await this.db
      .update(s.schools)
      .set({ aiCreditsBalance: this.creditBalance })
      .where(eq(s.schools.id, this.id));
    this.school = { ...this.school, aiCreditsBalance: this.creditBalance };
  }

  async aiGeneration(opts: {
    kind: (typeof s.aiGenerationKind.enumValues)[number];
    status: (typeof s.aiGenerationStatus.enumValues)[number];
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    unitsProduced?: number;
    costCents: number;
    creditsCharged: number;
    contentUnitId?: string | null;
    requestedByMembershipId: string;
    origin?: string;
    errorCode?: string;
    errorMessage?: string;
    createdAt: Date;
    durationMs?: number;
  }) {
    const [row] = await this.db
      .insert(s.aiGenerations)
      .values({
        schoolId: this.id,
        kind: opts.kind,
        status: opts.status,
        provider: opts.provider,
        model: opts.model,
        inputTokens: opts.inputTokens ?? 0,
        outputTokens: opts.outputTokens ?? 0,
        unitsProduced: opts.unitsProduced ?? 0,
        costCents: opts.costCents,
        creditsCharged: opts.creditsCharged,
        contentUnitId: opts.contentUnitId ?? null,
        requestedByMembershipId: opts.requestedByMembershipId,
        origin: opts.origin ?? "app",
        errorCode: opts.errorCode ?? null,
        errorMessage: opts.errorMessage ?? null,
        durationMs: opts.durationMs ?? 12_000,
        createdAt: opts.createdAt,
        finishedAt: opts.status === "succeeded" || opts.status === "failed" ? opts.createdAt : null,
      })
      .returning();
    return row!;
  }

  /* ─── Transcripción ──────────────────────────────────────────────────── */

  async transcript(opts: {
    sessionId: string;
    status: (typeof s.transcriptStatus.enumValues)[number];
    provider: string;
    language: string;
    durationMs?: number;
    summary?: string;
    vocabulary?: Array<{ term: string; lemma?: string; level?: string; count: number }>;
    blockedReason?: string;
    segments?: Array<{
      startMs: number;
      endMs: number;
      text: string;
      speakerMembershipId?: string | null;
      speakerLabel: string;
      isTeacher: boolean;
    }>;
    createdAt: Date;
  }) {
    const retentionUntil = new Date(opts.createdAt);
    retentionUntil.setDate(retentionUntil.getDate() + this.spec.dataRetentionDays);

    const [row] = await this.db
      .insert(s.transcripts)
      .values({
        schoolId: this.id,
        sessionId: opts.sessionId,
        status: opts.status,
        provider: opts.provider,
        language: opts.language,
        durationMs: opts.durationMs ?? null,
        summary: opts.summary ?? null,
        vocabulary: opts.vocabulary ?? [],
        blockedReason: opts.blockedReason ?? null,
        recordingStorageKey:
          opts.status === "ready" ? `${this.spec.slug}/recordings/${opts.sessionId}` : null,
        retentionUntil: opts.status === "ready" ? retentionUntil : null,
        createdAt: opts.createdAt,
        readyAt: opts.status === "ready" ? opts.createdAt : null,
      })
      .returning();

    if (opts.segments?.length) {
      await this.db.insert(s.transcriptSegments).values(
        opts.segments.map((seg) => ({
          schoolId: this.id,
          transcriptId: row!.id,
          startMs: seg.startMs,
          endMs: seg.endMs,
          speakerMembershipId: seg.speakerMembershipId ?? null,
          speakerLabel: seg.speakerLabel,
          text: seg.text,
          confidence: 9200,
          isTeacher: seg.isTeacher,
        })),
      );
    }

    return row!;
  }

  /* ─── Plataforma ─────────────────────────────────────────────────────── */

  async mcpClient(opts: {
    name: string;
    clientKind: string;
    scopes: string[];
    authorizedByMembershipId: string;
    lastUsedAt?: Date | null;
    revokedAt?: Date | null;
  }) {
    const [row] = await this.db
      .insert(s.mcpClients)
      .values({
        schoolId: this.id,
        name: opts.name,
        clientId: `mcp_${this.spec.slug}_${opts.clientKind}`,
        clientSecretHash: "$argon2id$seed$placeholder",
        redirectUris: [
          opts.clientKind === "claude"
            ? "https://claude.ai/api/mcp/auth_callback"
            : "https://chatgpt.com/connector_platform_oauth_redirect",
        ],
        scopes: opts.scopes,
        clientKind: opts.clientKind,
        authorizedByMembershipId: opts.authorizedByMembershipId,
        lastUsedAt: opts.lastUsedAt ?? null,
        revokedAt: opts.revokedAt ?? null,
      })
      .returning();
    return row!;
  }

  async audit(opts: {
    action: string;
    entityType: string;
    entityId?: string | null;
    actorKind?: (typeof s.actorKind.enumValues)[number];
    actorMembershipId?: string | null;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    createdAt: Date;
  }) {
    const [row] = await this.db
      .insert(s.auditLogs)
      .values({
        schoolId: this.id,
        actorKind: opts.actorKind ?? "user",
        actorMembershipId: opts.actorMembershipId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        before: opts.before ?? null,
        after: opts.after ?? null,
        ipAddress: "203.0.113.42",
        userAgent: "Mozilla/5.0 (seed)",
        createdAt: opts.createdAt,
      })
      .returning();
    return row!;
  }
}
