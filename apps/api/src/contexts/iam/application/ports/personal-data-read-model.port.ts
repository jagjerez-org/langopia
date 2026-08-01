import type { PersonAccessContext } from "../../domain/model/personal-data-access.js";

/**
 * Modelo de lectura del derecho de acceso y portabilidad (Tarea 15, RGPD).
 *
 * Igual que `PortalReadModel` o `AssessmentReadModel`: SQL a mano en su
 * infraestructura, cruzando tablas de `people`, `catalog`, `scheduling`,
 * `assessment`, `classroom` y `billing` sin cargar ningún agregado ajeno. El
 * aislamiento entre escuelas lo sigue dando RLS; esta interfaz solo decide
 * QUÉ leer, no de quién es cada fila — eso lo decide
 * `canAccessPersonalData()` sobre el resultado de `accessContext`.
 *
 * `notifications` no aparece: no persiste nada (envía correo y ya, ver
 * `docs/RGPD.md`), así que no hay tabla que exportar de ese contexto.
 */

export type PersonRole = "owner" | "admin" | "teacher" | "student" | "guardian";

export type GuardianOfPerson = {
  membershipId: string;
  name: string;
  relationship: string;
  canGiveConsent: boolean;
};

export type WardOfGuardian = {
  studentMembershipId: string;
  studentName: string;
  relationship: string;
  canGiveConsent: boolean;
};

export type StudentProfileSection = {
  studentProfileId: string;
  dateOfBirth: string;
  isMinor: boolean;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string | null;
  targetLevel: string | null;
  goals: string | null;
  status: string;
  joinedAt: string;
  pausedUntil: string | null;
  leftAt: string | null;
  leftReason: string | null;
  guardians: GuardianOfPerson[];
};

export type TeacherProfileSection = {
  teacherProfileId: string;
  tier: string;
  languages: string[];
  isNativeSpeaker: boolean;
  hourlyRateCents: number;
  currency: string;
  contractedHoursWeek: number;
  status: string;
  hiredAt: string;
  leftAt: string | null;
  leftReason: string | null;
};

export type ConsentEntry = {
  kind: string;
  status: string;
  grantedByMembershipId: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  policyVersion: string;
};

export type EnrollmentEntry = {
  enrollmentId: string;
  courseCode: string;
  groupName: string;
  status: string;
  enrolledAt: string;
  endedAt: string | null;
};

export type AttendanceEntry = {
  sessionId: string;
  groupName: string;
  scheduledStart: string;
  status: string;
  source: string;
  minutesPresent: number | null;
};

export type AttemptEntry = {
  attemptId: string;
  exerciseId: string;
  attemptNumber: number;
  status: string;
  aiScore: number | null;
  teacherScore: number | null;
  submittedAt: string;
};

export type AssessmentEntry = {
  assessmentId: string;
  kind: string;
  title: string;
  status: string;
  levelBefore: string | null;
  levelResult: string | null;
  score: number | null;
  maxScore: number | null;
  scheduledFor: string | null;
};

export type EvaluationEntry = {
  evaluationId: string;
  /** Si esta persona fue la valorada o quien valoró. */
  as: "student" | "teacher";
  counterpartName: string;
  periodStart: string;
  periodEnd: string;
  progressRating: number;
  strengths: string | null;
  improvements: string | null;
  nextSteps: string | null;
  createdAt: string;
};

export type InvoiceEntry = {
  invoiceId: string;
  number: string;
  direction: string;
  status: string;
  currency: string;
  totalCents: number;
  issuedOn: string | null;
  dueOn: string | null;
  paidAt: string | null;
};

export type TranscriptEntry = {
  transcriptId: string;
  sessionId: string;
  status: string;
  language: string;
  /** Si esta persona habló en algún segmento identificado. */
  spokeInSession: boolean;
  hasRecording: boolean;
  /** Solo lo que ella misma dijo, no la conversación entera. */
  ownSegments: Array<{ startMs: number; endMs: number; text: string }>;
};

export type PersonalDataExport = {
  membershipId: string;
  name: string;
  email: string;
  role: PersonRole;
  membershipStatus: string;
  locale: string;
  timezone: string;
  createdAt: string;
  lastSeenAt: string | null;
  joinedAt: string;
  student: StudentProfileSection | null;
  teacher: TeacherProfileSection | null;
  /** Si esta membresía es tutora de otros alumnos. */
  wardsAsGuardian: WardOfGuardian[];
  consents: ConsentEntry[];
  enrollments: EnrollmentEntry[];
  attendance: AttendanceEntry[];
  attempts: AttemptEntry[];
  assessments: AssessmentEntry[];
  evaluations: EvaluationEntry[];
  invoices: InvoiceEntry[];
  transcripts: TranscriptEntry[];
};

export interface PersonalDataReadModel {
  /** `null` si la membresía no existe en esta escuela (RLS ya se ocupa del aislamiento). */
  accessContext(membershipId: string): Promise<PersonAccessContext | null>;

  exportFor(membershipId: string): Promise<PersonalDataExport>;
}

export const PERSONAL_DATA_READ_MODEL = Symbol("PersonalDataReadModel");
