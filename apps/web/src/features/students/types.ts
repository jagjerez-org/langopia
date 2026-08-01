/**
 * Tipos del cliente para la Tarea 7 (Alumnado), sobre los endpoints de
 * `people` (ola 1, tareas 2, 13 y 14) y el de exportación RGPD de `iam`
 * (tarea 15), que es de donde sale el resto de la ficha (asistencia,
 * consentimientos, facturas, valoraciones) sin duplicar ningún modelo de
 * lectura ya construido en el backend.
 */

export type StudentStatus = "active" | "paused" | "left";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type GuardianRelationship = "mother" | "father" | "legal_guardian" | "other";
export type ConsentKind =
  | "data_processing"
  | "recording"
  | "transcription"
  | "ai_processing"
  | "marketing"
  | "image_rights";

/** Fila de `GET /students`. */
export type StudentListItem = {
  studentId: string;
  membershipId: string;
  name: string;
  email: string;
  status: StudentStatus;
  dateOfBirth: string;
  guardianRequired: boolean;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: CefrLevel | null;
  joinedAt: string;
};

export type GuardianInput = {
  name: string;
  email: string;
  relationship: GuardianRelationship;
};

/** Cuerpo de `POST /students`. */
export type EnrolStudentInput = {
  name: string;
  email: string;
  dateOfBirth: string;
  nativeLanguage: string;
  targetLanguage: string;
  locale?: string | null;
  currentLevel?: CefrLevel | null;
  guardian?: GuardianInput | null;
};

export type EnrolStudentResult = {
  studentId: string;
  guardianRequired: boolean;
  currentLevel: CefrLevel | null;
};

/** Cuerpo de `PATCH /students/:id`: semántica de parche, campo ausente = no tocar. */
export type UpdateStudentInput = {
  dateOfBirth?: string;
  currentLevel?: CefrLevel | null;
};

export type UpdateStudentResult = EnrolStudentResult;

export type LeaveStudentResult = { studentId: string; status: StudentStatus };

/* ─── Importación por CSV (Tarea 14) ──────────────────────────────────── */

export type ImportRowError = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type ImportedGuardianData = GuardianInput;

export type ImportedStudentData = {
  name: string;
  email: string;
  dateOfBirth: string;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: CefrLevel | null;
  guardian: ImportedGuardianData | null;
};

/**
 * Fila del informe. `/students/import/preview` solo produce `"valid"` e
 * `"invalid"`; `/students/import/commit` reemplaza `"valid"` por `"created"`
 * u `"updated"` (según si el correo ya existía en la escuela) porque ahí
 * cada fila válida sí se ha escrito de verdad — el mismo contrato en las dos
 * rutas, con más detalle en la que confirma.
 */
export type ImportRowResult =
  | { row: number; status: "valid"; data: ImportedStudentData }
  | { row: number; status: "created"; studentId: string }
  | { row: number; status: "updated"; studentId: string }
  | { row: number; status: "invalid"; errors: ImportRowError[] };

/** Respuesta común de `/students/import/preview` y `/students/import/commit`. */
export type ImportReport = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  /** Solo en la respuesta de `commit`. */
  createdCount?: number;
  updatedCount?: number;
  rows: ImportRowResult[];
};

/* ─── Exportación de datos personales (RGPD, Tarea 15) ────────────────────
 * Recorte de `PersonalDataExport` (API): solo los campos que usa la ficha.
 * El tipo real de la API trae más (profesorado, transcripciones...), pero
 * TypeScript estructural no exige declarar lo que no se lee.
 */

export type GuardianOfPerson = {
  membershipId: string;
  name: string;
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

export type ConsentEntry = {
  kind: string;
  status: string;
  grantedByMembershipId: string | null;
  grantedAt: string | null;
  withdrawnAt: string | null;
  policyVersion: string;
};

export type AttendanceEntry = {
  sessionId: string;
  groupName: string;
  scheduledStart: string;
  status: string;
  source: string;
  minutesPresent: number | null;
};

export type EvaluationEntry = {
  evaluationId: string;
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

export type PersonalDataExport = {
  membershipId: string;
  name: string;
  email: string;
  student: StudentProfileSection | null;
  consents: ConsentEntry[];
  attendance: AttendanceEntry[];
  evaluations: EvaluationEntry[];
  invoices: InvoiceEntry[];
};

/* ─── Valoraciones (contexto `assessment`) ─────────────────────────────── */

export type EvaluateStudentInput = {
  teacherId: string;
  studentId: string;
  periodStart: string;
  periodEnd: string;
  progressRating: number;
  levelAtEvaluation?: CefrLevel | null;
  strengths?: string | null;
  improvements?: string | null;
  nextSteps?: string | null;
};

export type EvaluateStudentResult = { evaluationId: string };

/** Fila de `GET /assessments/students-without-evaluation`. */
export type StudentWithoutEvaluation = {
  studentId: string;
  name: string;
  joinedAt: string;
  weeksSinceLastEvaluation: number | null;
};

/* ─── Progreso del alumno (Tarea 16 de la ola 2) ────────────────────────── */

export type SkillProgress = {
  skill: string;
  /** 0–1: solo intentos validados por el profesor. */
  averageScore: number;
  attemptCount: number;
};

export type ProgressTrendPoint = {
  /** Lunes de la semana, `YYYY-MM-DD`. */
  weekStart: string;
  averageScore: number;
  /** Media móvil de hasta las 4 semanas con datos más recientes, terminando en esta. */
  movingAverage: number;
};

/**
 * `GET /assessments/students/:studentId/progress`. Mismo endpoint para la
 * ficha del alumno (dirección y profesorado) y para el portal (el propio
 * alumno o su tutor legal): quién puede verlo lo decide la API, no esta
 * pantalla.
 */
export type StudentProgress = {
  publishedExercises: number;
  completedExercises: number;
  /** `null`: todavía no hay ningún ejercicio publicado a sus grupos. */
  completionRate: number | null;
  validatedAttempts: number;
  /** `null`: todavía no hay ningún intento validado por el profesor. */
  averageScore: number | null;
  skillBreakdown: SkillProgress[];
  trend: ProgressTrendPoint[];
  reviewStreakDays: number;
};
