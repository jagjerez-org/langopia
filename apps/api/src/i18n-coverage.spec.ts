import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "./contexts/shared/infrastructure/i18n/locale.resolver.js";
import { MESSAGES, translateError } from "./contexts/shared/infrastructure/i18n/messages.js";
import {
  ConcurrencyError,
  NotFoundError,
  type DomainError,
} from "./contexts/shared/domain/errors/domain-error.js";
import { InvalidUuidError } from "./contexts/shared/domain/primitives/uuid.js";
import { MissingTenantError } from "./contexts/shared/infrastructure/tenant/cls-tenant-context.js";
import {
  CheckViolationError,
  ForeignKeyViolationError,
  InvalidTextRepresentationError,
  UniqueViolationError,
} from "./contexts/shared/infrastructure/http/all-exceptions.filter.js";
import {
  CannotScheduleInThePastError,
  InvalidTimeSlotError,
  SessionAlreadyClosedError,
  SessionNotStartedError,
  StudentNotEnrolledError,
  TeacherNotAvailableError,
  TeacherOverlapError,
  UnknownRoomProviderError,
} from "./contexts/scheduling/domain/errors/scheduling.errors.js";
import { InvalidCancellationPolicyError } from "./contexts/scheduling/domain/model/cancellation-policy.js";
import { InvalidRoomError, ROOM_PROVIDERS } from "./contexts/scheduling/domain/model/room.vo.js";
import { MissingActorError } from "./contexts/scheduling/application/commands/cancel-class-session/cancel-class-session.handler.js";
import {
  DuplicateEmailInImportError,
  GuardianRequiredError,
  InvalidContractedHoursError,
  InvalidImportFieldError,
  InvalidImportFileError,
  LeadAlreadyClosedError,
  LeadAlreadyConvertedError,
  MinorCannotSelfConsentError,
  NotAGuardianError,
  StudentAlreadyLeftError,
  TeacherAlreadyLeftError,
} from "./contexts/people/domain/errors/people.errors.js";
import {
  ContentUnitAlreadyPublishedError,
  ContentUnitArchivedError,
  ContentUnitHasNoExercisesError,
  ContentUnitLevelMismatchError,
  ContentUnitNotInDraftError,
  DueCardsAccessDeniedError,
  InvalidReviewQualityError,
  MaterialNotIndexedError,
  MissingReviewerError,
  UnitGenerationFailedError,
  UnitGroupsMultipleCoursesError,
} from "./contexts/learning/domain/errors/learning.errors.js";
import {
  MaterialTooLargeError,
  UnsupportedMaterialFormatError,
} from "./contexts/learning/domain/model/uploaded-material.vo.js";
import { MissingActorError as GenerateUnitMissingActorError } from "./contexts/learning/application/commands/generate-unit/generate-unit.handler.js";
import { InvalidDateOfBirthError } from "./contexts/people/domain/model/date-of-birth.vo.js";
import { InvalidHourlyRateError } from "./contexts/people/domain/model/hourly-rate.vo.js";
import {
  InvalidAvailabilitySlotError,
  OverlappingAvailabilityError,
} from "./contexts/people/domain/model/weekly-availability.vo.js";
import {
  GroupAlreadyStartedError,
  GroupFullError,
  MissingDefaultTranslationError,
  NegativeAgreedPriceError,
  StudentNotActiveError,
} from "./contexts/catalog/domain/errors/catalog.errors.js";
import {
  ForbiddenRoleError,
  MissingRoleAnnotationError,
  UnknownRestrictedActionError,
} from "./contexts/iam/infrastructure/http/authenticated.guard.js";
import {
  EmailNotVerifiedError,
  SchoolNotOperationalError,
  TenantResolutionError,
} from "./contexts/iam/infrastructure/http/session-tenant.guard.js";
import {
  NotEnrolledInSessionError,
  RoomNotReadyError,
} from "./contexts/classroom/domain/errors/classroom.errors.js";
import {
  CurrencyMismatchError,
  InsufficientCreditsError,
  InvalidCreditAmountError,
  InvalidInvoiceLineError,
  InvalidInvoiceStateError,
  InvalidMoneyAmountError,
  InvalidPlatformFeeError,
  PaymentExceedsInvoiceTotalError,
  PlatformFeeNotAllowedError,
  RefundExceedsPaymentError,
} from "./contexts/billing/domain/errors/billing.errors.js";
import {
  InvalidWebhookSignatureError,
  StripeWebhookNotConfiguredError,
} from "./contexts/billing/infrastructure/http/webhooks/stripe-webhook.controller.js";
import { InvalidSchoolSlugError } from "./contexts/iam/domain/model/school-slug.vo.js";
import {
  InvitationAlreadyResolvedError,
  InvitationEmailMismatchError,
  InvitationExpiredError,
} from "./contexts/iam/domain/model/invitation.aggregate.js";
import { UnknownMembershipRoleError } from "./contexts/iam/application/commands/invite-member/invite-member.handler.js";
import { AuthenticationRequiredError } from "./contexts/iam/infrastructure/http/schools.controller.js";
import { PortalAccessDeniedError } from "./contexts/portal/domain/errors/portal.errors.js";
import {
  AttemptAccessDeniedError,
  EmptyAttemptResponseError,
  EmptyExamSubmissionError,
  EvaluationFrozenError,
  EvaluationPeriodInFutureError,
  EvaluationPeriodOverlapError,
  ExamGenerationRejectedError,
  ExamHasNoItemsError,
  ExamItemDuplicatesPracticeError,
  ExamMockFrameworkRequiredError,
  ExamRequiresSourceUnitsError,
  ExamScheduledInPastError,
  ExamSkillDistributionInvalidError,
  ExamSourceUnitNotPublishedError,
  InvalidAttemptScoreError,
  InvalidAttemptStateError,
  InvalidExamScoreError,
  InvalidExamStateError,
  InvalidProgressRatingError,
  MaxAttemptsExceededError,
  MissingExamActorError,
  PlacementBankExhaustedError,
  PlacementTestAlreadyFinishedError,
  PlacementTestIdMismatchError,
  RubricScoreMismatchError,
  StudentProgressAccessDeniedError,
  TeacherCannotViewStudentProgressError,
  TeacherDoesNotTeachStudentError,
} from "./contexts/assessment/domain/errors/assessment.errors.js";
import { InvalidExamItemError } from "./contexts/assessment/domain/model/exam-item-schemas.js";
import {
  PersonAlreadyErasedError,
  PersonHasOtherSchoolMembershipsError,
  PersonalDataAccessDeniedError,
} from "./contexts/iam/domain/errors/personal-data.errors.js";
import {
  ImpersonationAlreadyEndedError,
  InvalidImpersonationReasonError,
} from "./contexts/iam/domain/model/impersonation.aggregate.js";
import {
  CannotImpersonateSelfError,
  ImpersonationAlreadyActiveError,
  ImpersonationChainError,
  ImpersonationNotAllowedError,
} from "./contexts/iam/domain/model/impersonation-rules.js";
import { ImpersonationForbiddenActionError } from "./contexts/iam/infrastructure/http/authenticated.guard.js";
import { NoActiveImpersonationError } from "./contexts/iam/infrastructure/http/impersonation.controller.js";
import { InvalidExerciseError } from "./contexts/learning/domain/model/exercise-schemas.js";
import {
  TranscriptBlockedError,
  TranscriptNotProcessingError,
} from "./contexts/classroom/domain/model/transcript.aggregate.js";
import {
  AlreadyAcknowledgedReviewError,
  InactiveSurveyError,
  InvalidReviewRatingError,
  InvalidSurveyScoreError,
  MissingRespondentMembershipError,
  MissingReviewerMembershipError,
  SurveyAccessDeniedError,
  SurveyAudienceMismatchError,
  SurveySessionRequiredError,
} from "./contexts/feedback/domain/errors/feedback.errors.js";
import {
  DuplicateSiteDomainError,
  InvalidSiteBlockError,
  InvalidSiteDomainError,
  InvalidSiteError,
  InvalidSitePageError,
} from "./contexts/sites/domain/errors/sites.errors.js";
import { PublicSiteRateLimitError } from "./contexts/sites/infrastructure/http/public-sites.controller.js";

// `import.meta.dirname` no vale aquí: este workspace compila a CommonJS y
// `tsc` rechaza `import.meta` en ese modo (ver `architecture.spec.ts`).
// `__dirname` es el global equivalente para CommonJS.
const SRC_DIR = __dirname;

/** Todo `readonly code = "..."` que exista en el dominio. */
function codesInDomain(): string[] {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".ts")) {
        for (const m of readFileSync(path, "utf8").matchAll(/readonly code = "([a-z_]+)"/g)) {
          found.add(m[1]!);
        }
      }
    }
  };
  walk(join(SRC_DIR, "contexts"));
  return [...found];
}

describe("cobertura del catálogo de errores", () => {
  it("todo error de dominio tiene mensaje", () => {
    const missing = codesInDomain().filter((code) => !MESSAGES[code]);
    expect(missing, `sin traducir: ${missing.join(", ")}`).toEqual([]);
  });

  it("todo mensaje está en todos los idiomas soportados", () => {
    const gaps: string[] = [];
    for (const [code, byLocale] of Object.entries(MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        if (!byLocale[locale]) gaps.push(`${code} → ${locale}`);
      }
    }
    expect(gaps, gaps.join("\n")).toEqual([]);
  });

  it("no sobra ningún mensaje", () => {
    // Un código traducido que ya no lanza nadie es texto muerto que alguien
    // mantendrá creyendo que sirve.
    const codes = new Set(codesInDomain());
    const orphans = Object.keys(MESSAGES).filter((c) => !codes.has(c));
    expect(orphans, `sin uso: ${orphans.join(", ")}`).toEqual([]);
  });
});

/* ─── Lo que el error pasa DE VERDAD como parámetros ───────────────────── */

/**
 * Un ejemplar real de cada error de dominio del código.
 *
 * Las tres pruebas de arriba solo miran el catálogo: comprueban que existe una
 * entrada por código y en los cinco idiomas. Eso no basta, y costó un fallo en
 * producción — `insufficient_role` pasaba `{required: string[]}` a un mensaje
 * que interpola `{required}`. `IntlMessageFormat` no lanza con un parámetro
 * que no es un escalar: devuelve un ARRAY mezclando texto y el valor sin
 * convertir, el `as string` de `translateError` lo deja pasar, y el filtro de
 * errores lo trataba como fallo de traducción y caía al mensaje en español del
 * `super()`. Resultado: los cinco idiomas devolvían el mismo texto en español,
 * con el catálogo aparentemente completo.
 *
 * La única forma de ver eso es instanciar el error y traducirlo con SUS
 * `details`, que es lo que hace este muestrario. Por eso varias clases de
 * error que antes eran privadas de su módulo están exportadas: son el objeto
 * que hay que examinar.
 *
 * Los argumentos son realistas a propósito —la forma de `details` es lo que se
 * está probando—, y cuando un error tiene varias ramas con `details` distintos
 * se elige la que más parámetros lleva.
 */
const ERROR_SAMPLES: readonly DomainError[] = [
  new NotFoundError("ClassSession", "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new ConcurrencyError("ClassSession", "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new MissingTenantError(),
  new InvalidUuidError("no-es-un-uuid", "SessionId"),
  new UniqueViolationError(),
  new ForeignKeyViolationError(),
  new CheckViolationError(),
  new InvalidTextRepresentationError(),
  new InvalidTimeSlotError("una clase no puede durar más de 8 horas", { minutes: 600 }),
  new SessionAlreadyClosedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "canceled_by_school", "reprogramar"),
  new TeacherNotAvailableError(
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    new Date("2026-09-01T08:00:00Z"),
    new Date("2026-09-01T09:00:00Z"),
  ),
  new TeacherOverlapError(
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  ),
  new UnknownRoomProviderError("hangouts", ROOM_PROVIDERS),
  new CannotScheduleInThePastError(new Date("2026-01-01T10:00:00Z"), new Date("2026-07-27T10:00:00Z")),
  new InvalidRoomError("Una clase en zoom necesita un enlace de conexión.", { provider: "zoom" }),
  new InvalidCancellationPolicyError("La antelación mínima debe ser un número de horas no negativo.", {
    minimumNoticeHours: -1,
  }),
  new MissingActorError(),
  new MinorCannotSelfConsentError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new NotAGuardianError("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new StudentAlreadyLeftError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new GuardianRequiredError(),
  new InvalidImportFileError("Faltan columnas obligatorias en el CSV.", { missing: ["email"] }),
  new DuplicateEmailInImportError("ana@example.com"),
  new InvalidImportFieldError("nivel", "no es un nivel MCER reconocido"),
  new InvalidDateOfBirthError("La fecha de nacimiento está en el futuro.", { value: "2030-01-01" }),
  new InvalidHourlyRateError("La tarifa del tramo «community» debe estar entre 4 y 15 €/h.", {
    tier: "community",
    cents: 1600,
  }),
  new InvalidContractedHoursError(61),
  new InvalidAvailabilitySlotError("La franja horaria no es válida.", {
    startMinute: 600,
    endMinute: 600,
  }),
  new OverlappingAvailabilityError(3),
  new TeacherAlreadyLeftError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new GroupFullError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", 5),
  new StudentNotActiveError("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"),
  new NegativeAgreedPriceError(-100),
  new MissingDefaultTranslationError("es-ES"),
  new GroupAlreadyStartedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "running"),
  new ForbiddenRoleError(["owner", "admin"], ["teacher"]),
  new MissingRoleAnnotationError(),
  new UnknownRestrictedActionError("paymnet_operation"),
  new TenantResolutionError("Perteneces a varias escuelas: indica la escuela.", {
    schools: ["atlantico", "paulista"],
  }),
  new SchoolNotOperationalError("atlantico", "canceled"),
  new EmailNotVerifiedError(),
  new RoomNotReadyError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "pending_oauth"),
  new NotEnrolledInSessionError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new InvalidMoneyAmountError("el importe no puede ser negativo", { cents: -100 }),
  new CurrencyMismatchError("EUR", "USD"),
  new InvalidPlatformFeeError("los puntos básicos deben ser un entero entre 0 y 10000", { bps: -1 }),
  new InvalidInvoiceLineError("la cantidad debe ser un entero positivo", { quantity: 0 }),
  new InvalidInvoiceStateError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "paid", "registrar un cobro en"),
  new PlatformFeeNotAllowedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new PaymentExceedsInvoiceTotalError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", 5000, 2000),
  new RefundExceedsPaymentError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", 5000, 2000),
  new InvalidCreditAmountError(-5),
  new InsufficientCreditsError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", 30, 10),
  new SessionNotStartedError(
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    new Date("2026-09-01T09:00:00Z"),
    new Date("2026-09-01T08:00:00Z"),
  ),
  new StudentNotEnrolledError(
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
  ),
  new InvalidWebhookSignatureError(),
  new StripeWebhookNotConfiguredError(),
  new PortalAccessDeniedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new InvalidSchoolSlugError("«admin» es una palabra reservada: no puede usarse como identificador de escuela.", {
    value: "admin",
  }),
  new InvitationExpiredError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new InvitationAlreadyResolvedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new InvitationEmailMismatchError(),
  new UnknownMembershipRoleError("superadmin", ["owner", "admin", "teacher", "student", "guardian"]),
  new AuthenticationRequiredError(),
  new InvalidProgressRatingError(6),
  new EvaluationPeriodInFutureError(
    new Date("2026-12-01T00:00:00Z"),
    new Date("2026-07-27T10:00:00Z"),
  ),
  new EvaluationFrozenError(
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    new Date("2026-09-30T10:00:00Z"),
    new Date("2026-10-15T10:00:00Z"),
  ),
  new EvaluationPeriodOverlapError(
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  ),
  new TeacherDoesNotTeachStudentError(
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
  ),
  new TeacherCannotViewStudentProgressError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new StudentProgressAccessDeniedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new MaxAttemptsExceededError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", 4, 3),
  new InvalidAttemptStateError(
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "gradeWithAi",
    "teacher_validated",
  ),
  new InvalidAttemptScoreError(-1),
  new EmptyAttemptResponseError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new RubricScoreMismatchError("mcer-escrita", ["adecuacion", "coherencia"], ["adecuacion"]),
  new PlacementTestAlreadyFinishedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new PlacementTestIdMismatchError(
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  ),
  new PlacementBankExhaustedError("en"),
  new ExamRequiresSourceUnitsError(),
  new ExamSourceUnitNotPublishedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "draft"),
  new ExamSkillDistributionInvalidError(90),
  new ExamHasNoItemsError(),
  new ExamMockFrameworkRequiredError(),
  new ExamItemDuplicatesPracticeError(
    "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  ),
  new InvalidExamStateError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "start", "in_progress"),
  new EmptyExamSubmissionError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new InvalidExamScoreError(-1),
  new ExamScheduledInPastError(new Date("2026-01-01T00:00:00Z"), new Date("2026-07-27T00:00:00Z")),
  new ExamGenerationRejectedError("la respuesta no tiene la forma JSON esperada."),
  new MissingExamActorError(),
  new InvalidExamItemError("cloze", "prompt.blanks: falta el hueco {{1}}."),
  new PersonalDataAccessDeniedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new PersonAlreadyErasedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new PersonHasOtherSchoolMembershipsError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new InvalidImpersonationReasonError(),
  new ImpersonationAlreadyEndedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new CannotImpersonateSelfError(),
  new ImpersonationChainError(),
  new ImpersonationAlreadyActiveError(),
  new ImpersonationNotAllowedError(),
  new ImpersonationForbiddenActionError("payment_operation"),
  new NoActiveImpersonationError(),
  new ContentUnitHasNoExercisesError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new ContentUnitAlreadyPublishedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new ContentUnitArchivedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "publicar"),
  new ContentUnitNotInDraftError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "published"),
  new ContentUnitLevelMismatchError("B1", "A1"),
  new UnitGenerationFailedError(
    "ES-B1-U07",
    "La generación no produjo una salida válida tras 2 intentos.",
  ),
  new GenerateUnitMissingActorError(),
  new MissingReviewerError(),
  new InvalidExerciseError(
    "multiple_choice",
    "`correct` (4) está fuera de rango: solo hay 4 opciones.",
  ),
  new InvalidReviewQualityError(6),
  // Tarea 12 de la ola 2 (panel y portal — hacer ejercicios).
  new AttemptAccessDeniedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new DueCardsAccessDeniedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  // Tarea 14 de la ola 2 (subida de material propio). `UnsupportedMaterialFormatError`
  // es justo el caso que la regla de parámetros escalares vigila: sus
  // `details` llevan un array (`validFormats`) ADEMÁS del escalar que
  // interpola el texto (`validFormatsLabel`).
  new UnsupportedMaterialFormatError("apuntes.key"),
  new MaterialTooLargeError(150 * 1024 * 1024),
  new MaterialNotIndexedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  // Tarea 11 del panel (publicar a grupos).
  new UnitGroupsMultipleCoursesError(2),
  // Transcripciones (`classroom`) y encuestas/reseñas (`feedback`).
  new TranscriptBlockedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new TranscriptNotProcessingError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "reintentar"),
  new InvalidSurveyScoreError("nps", 11, 0, 10),
  new InactiveSurveyError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new SurveyAudienceMismatchError("student", "teacher"),
  new SurveySessionRequiredError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new SurveyAccessDeniedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new MissingRespondentMembershipError(),
  new InvalidReviewRatingError(6),
  new AlreadyAcknowledgedReviewError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new MissingReviewerMembershipError(),
  // Candidatos (`people`) y sitio público (`sites`).
  new LeadAlreadyConvertedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b"),
  new LeadAlreadyClosedError("0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "discarded"),
  new InvalidSiteBlockError("El texto enriquecido solo admite títulos y párrafos.", { kind: "quote" }),
  new InvalidSitePageError("Una página solo puede tener un bloque hero.", {
    pageId: "0f0d1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    heroCount: 2,
  }),
  new InvalidSiteError("El slug de la página debe ser único dentro del sitio.", { slug: "precios" }),
  new InvalidSiteDomainError("El dominio no tiene un formato válido.", {
    hostname: "https://academia.example.com",
  }),
  new DuplicateSiteDomainError("academia.example.com"),
  new PublicSiteRateLimitError(),
];

/**
 * Códigos del catálogo que NO los lanza ninguna clase: los asigna
 * `AllExceptionsFilter` directamente (`validation_failed` para un
 * `HttpException` de Nest, `internal_error` para todo lo demás) o son el
 * ejemplo de plural ICU que documenta `messages.ts` (`pending_reviews`).
 * `codesInDomain()` los encuentra porque las notas de `messages.ts` los citan
 * literalmente, a propósito, para que la prueba de huérfanos los dé por
 * cubiertos. No hay error que instanciar, así que quedan fuera del muestrario.
 */
const CODIGOS_SIN_CLASE = new Set(["validation_failed", "internal_error", "pending_reviews"]);

describe("los parámetros que pasa un error de dominio se pueden traducir", () => {
  const porCodigo = new Set(ERROR_SAMPLES.map((error) => error.code));

  it("hay un ejemplar de cada error de dominio", () => {
    // Sin esto el muestrario envejece en silencio: un error nuevo con
    // parámetros no traducibles pasaría sin que nadie lo mirase.
    const missing = codesInDomain().filter(
      (code) => !CODIGOS_SIN_CLASE.has(code) && !porCodigo.has(code),
    );
    expect(missing, `sin ejemplar en ERROR_SAMPLES: ${missing.join(", ")}`).toEqual([]);
  });

  it("cada ejemplar produce una cadena en todos los idiomas, con sus propios details", () => {
    const gaps: string[] = [];

    for (const error of ERROR_SAMPLES) {
      for (const locale of SUPPORTED_LOCALES) {
        let rendered: unknown;
        try {
          rendered = translateError(error.code, locale, error.details);
        } catch (fallo) {
          gaps.push(
            `${error.code} → ${locale}: el patrón pide un parámetro que el error no trae ` +
              `(details: ${Object.keys(error.details).join(", ") || "ninguno"}) — ${(fallo as Error).message}`,
          );
          continue;
        }
        if (typeof rendered !== "string") {
          gaps.push(
            `${error.code} → ${locale}: los details no producen una cadena. Algún parámetro no ` +
              `es un valor simple (details: ${JSON.stringify(error.details)})`,
          );
        }
      }
    }

    expect(gaps, gaps.join("\n")).toEqual([]);
  });
});
