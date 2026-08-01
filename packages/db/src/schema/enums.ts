import { pgEnum } from "drizzle-orm/pg-core";

/* ─── Tenancy e identidad ──────────────────────────────────────────────── */

export const membershipRole = pgEnum("membership_role", [
  "owner", // dueño de la escuela: facturación y borrado
  "admin", // administración: alumnos, profesores, calendario, cobros
  "teacher",
  "student",
  "guardian", // tutor legal de un alumno menor
]);

export const membershipStatus = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
  "left",
]);

export const schoolStatus = pgEnum("school_status", [
  "trial",
  "active",
  "past_due", // impago de TU suscripción
  "canceled",
]);

/** Estado del onboarding del comerciante para cobrar directamente a sus alumnos. */
export const merchantStatus = pgEnum("merchant_status", [
  "not_started",
  "pending", // datos enviados, el proveedor de pago verificando
  "active",
  "restricted", // faltan datos, cobros limitados
  "disabled",
]);

/* ─── Personas ─────────────────────────────────────────────────────────── */

export const studentStatus = pgEnum("student_status", [
  "active",
  "paused", // matrícula congelada, vuelve
  "left", // baja
]);

export const teacherStatus = pgEnum("teacher_status", ["active", "on_leave", "left"]);

/** Tramos de tarifa observados en italki y Preply. */
export const teacherTier = pgEnum("teacher_tier", [
  "community", // conversación, sin titulación — 4-15 €/h
  "professional", // titulado, clases estructuradas — 15-40 €/h
  "specialist", // preparación de examen, business — 30-75 €/h
]);

/* ─── Protección de datos ──────────────────────────────────────────────── */

export const consentKind = pgEnum("consent_kind", [
  "data_processing", // base para tratar los datos del alumno
  "recording", // grabar la clase
  "transcription", // transcribir la grabación
  "ai_processing", // procesar sus respuestas con IA
  "marketing",
  "image_rights", // uso de su imagen en la web de la escuela
]);

export const consentStatus = pgEnum("consent_status", [
  "pending",
  "granted",
  "denied",
  "withdrawn",
]);

export const guardianRelationship = pgEnum("guardian_relationship", [
  "mother",
  "father",
  "legal_guardian",
  "other",
]);

/* ─── Catálogo formativo ───────────────────────────────────────────────── */

export const cefrLevel = pgEnum("cefr_level", ["A1", "A2", "B1", "B2", "C1", "C2"]);

export const languageSkill = pgEnum("language_skill", [
  "listening",
  "reading",
  "speaking",
  "writing",
  "vocabulary",
  "grammar",
  "phonetics",
]);

export const courseModality = pgEnum("course_modality", [
  "private", // 1 a 1
  "group", // 3-5 alumnos, el estándar del sector
  "intensive", // formato sprint
  "exam_prep", // DELE, Cambridge, Goethe
  "business",
  "conversation",
]);

export const groupStatus = pgEnum("group_status", [
  "planned",
  "running",
  "finished",
  "canceled",
]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "withdrawn",
  "transferred", // se movió a otro grupo
]);

/* ─── Programación de clases ───────────────────────────────────────────── */

export const sessionStatus = pgEnum("session_status", [
  "scheduled",
  "in_progress",
  "completed",
  "canceled_by_school",
  "canceled_by_student",
  "rescheduled", // esta instancia se sustituyó por otra
  "no_show", // nadie se conectó
]);

export const roomProvider = pgEnum("room_provider", [
  "livekit", // aula propia
  "zoom",
  "google_meet",
  "ms_teams",
  "in_person",
]);

export const attendanceStatus = pgEnum("attendance_status", [
  "present",
  "late",
  "absent",
  "excused",
]);

export const attendanceSource = pgEnum("attendance_source", [
  "auto", // detectada por el aula propia
  "manual", // marcada por el profesor
  "imported", // del informe de asistencia de Zoom/Meet/Teams
]);

/* ─── Contenido ────────────────────────────────────────────────────────── */

export const contentSource = pgEnum("content_source", [
  "ai_generated",
  "uploaded", // material propio de la escuela
  "hybrid", // generado a partir de material propio
]);

export const contentStatus = pgEnum("content_status", [
  "draft",
  "in_review", // generado, esperando validación del profesor
  "published",
  "archived",
]);

export const assetKind = pgEnum("asset_kind", ["audio", "image", "video", "document"]);

/**
 * Formato de un material subido por la escuela (tarea 14 de la ola 2). Los
 * únicos siete que acepta `POST /learning/materials`; cualquier otro se
 * rechaza con esta lista, nunca con un «formato no soportado» genérico.
 */
export const materialFormat = pgEnum("material_format", [
  "pdf",
  "docx",
  "mp3",
  "wav",
  "mp4",
  "jpg",
  "png",
]);

export const exerciseType = pgEnum("exercise_type", [
  "cloze", // hueco contextual — recuperación activa
  "multiple_choice",
  "matching",
  "ordering",
  "minimal_pairs", // discriminación fonética
  "dictation",
  "shadowing",
  "listening_comprehension",
  "reading_comprehension",
  "written_production", // corregido con rúbrica MCER
  "spoken_production",
]);

/* ─── Evaluación ───────────────────────────────────────────────────────── */

export const assessmentKind = pgEnum("assessment_kind", [
  "placement", // prueba de nivelación
  "unit_exam",
  "level_exam",
  "mock_official", // simulacro de DELE, Cambridge, Goethe
]);

export const assessmentStatus = pgEnum("assessment_status", [
  "scheduled",
  "in_progress",
  "submitted",
  "ai_graded",
  "teacher_validated",
  "canceled",
]);

export const attemptStatus = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "ai_graded",
  "teacher_validated", // la IA propone, el profesor firma
  "returned", // devuelto al alumno para rehacer
]);

/* ─── Satisfacción y calidad ───────────────────────────────────────────── */

export const surveyKind = pgEnum("survey_kind", [
  "nps",
  "csat",
  "post_session",
  "teacher_pulse", // satisfacción del propio profesorado
]);

export const respondentKind = pgEnum("respondent_kind", ["student", "teacher", "guardian"]);

export const reviewSubject = pgEnum("review_subject", ["material", "session", "teacher"]);

/* ─── Facturación ──────────────────────────────────────────────────────── */

/** Quién cobra a quién. La comisión solo existe en `school_to_student`. */
export const invoiceDirection = pgEnum("invoice_direction", [
  "platform_to_school", // tu suscripción
  "school_to_student", // vía el proveedor de pago de la escuela
]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "past_due",
  "void",
  "uncollectible",
]);

/**
 * Pasarela de pago que procesó un cobro. Hoy un único valor: no hay más
 * proveedor que Stripe. Existe igualmente para que el día que entre un
 * segundo, cada fila diga de quién es sin tocar el histórico.
 */
export const paymentProvider = pgEnum("payment_provider", ["stripe"]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const paymentMethod = pgEnum("payment_method", [
  "card",
  "sepa_debit",
  "bank_transfer",
  "cash",
]);

export const refundReason = pgEnum("refund_reason", [
  "requested_by_customer",
  "service_not_provided", // clase cancelada por la escuela
  "duplicate",
  "fraudulent",
  "goodwill",
]);

export const refundStatus = pgEnum("refund_status", ["pending", "succeeded", "failed", "canceled"]);

export const billingInterval = pgEnum("billing_interval", ["month", "year"]);

export const creditReason = pgEnum("credit_reason", [
  "plan_grant", // créditos incluidos en el plan, cada renovación
  "topup", // recarga comprada
  "generation", // consumo
  "refund", // devolución por generación fallida
  "adjustment", // ajuste manual tuyo
]);

/* ─── Transcripción ────────────────────────────────────────────────────── */

export const transcriptStatus = pgEnum("transcript_status", [
  "pending",
  "processing",
  "ready",
  "failed",
  "blocked_no_consent", // alguien de la clase no consintió: no se transcribe
]);

/* ─── Plataforma ───────────────────────────────────────────────────────── */

/**
 * `impersonation` (Tarea 17, ola 1): la acción la ejecutó de verdad una
 * membresía distinta de `actor_membership_id` — soporte de la plataforma o
 * un `owner`/`admin` actuando como otra persona de su escuela. La identidad
 * real queda en `audit_logs.impersonator_membership_id`, nunca sustituyendo
 * a `actor_membership_id`: ese sigue siendo quién PARECÍA hacerlo.
 */
export const actorKind = pgEnum("actor_kind", ["user", "system", "mcp", "webhook", "impersonation"]);

export const aiGenerationKind = pgEnum("ai_generation_kind", [
  "unit_outline",
  "unit_body",
  "exercise_set",
  "exam",
  "placement_test",
  "written_correction",
  "audio_tts",
  "image",
  "video_beta",
  "session_summary",
]);

export const aiGenerationStatus = pgEnum("ai_generation_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
