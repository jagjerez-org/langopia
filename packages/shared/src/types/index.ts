// ─── User & Auth ─────────────────────────────────────────

export enum UserPlan {
  FREE = "free",
  STARTER = "starter",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

export enum AcademyRole {
  OWNER = "owner",
  ADMIN = "admin",
  TEACHER = "teacher",
}

// ─── Room ────────────────────────────────────────────────

export enum RoomStatus {
  WAITING = "waiting",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum ParticipantRole {
  TEACHER = "teacher",
  STUDENT = "student",
}

// ─── Reports & AI ────────────────────────────────────────

export enum ReportStatus {
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum ExerciseType {
  FILL_IN_BLANK = "fill_in_blank",
  MULTIPLE_CHOICE = "multiple_choice",
  SENTENCE_REORDER = "sentence_reorder",
  ERROR_CORRECTION = "error_correction",
  FREE_RESPONSE = "free_response",
  LISTENING = "listening",
}

export enum ExerciseSource {
  AI_LIVE = "ai_live",
  AI_REPORT = "ai_report",
  MANUAL = "manual",
}

export enum TargetSkill {
  VOCABULARY = "vocabulary",
  GRAMMAR = "grammar",
  READING = "reading",
  WRITING = "writing",
  LISTENING = "listening",
}

// ─── Lesson ─────────────────────────────────────────

export enum LessonStatus {
  DRAFT = "draft",
  READY = "ready",
  COMPLETED = "completed",
}

// ─── CEFR & Languages ───────────────────────────────

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const EXERCISE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "ru", name: "Russian" },
] as const;

export function isBuiltInExerciseType(type: string): type is ExerciseType {
  return Object.values(ExerciseType).includes(type as ExerciseType);
}

// ─── Usage ───────────────────────────────────────────────

export enum UsageMetric {
  ROOMS_CREATED = "rooms_created",
  CLASS_MINUTES = "class_minutes",
  AI_REPORTS = "ai_reports",
  AI_TOKENS = "ai_tokens",
  STORAGE_BYTES = "storage_bytes",
}

// ─── Plan Limits ─────────────────────────────────────────

export const PLAN_LIMITS: Record<UserPlan, {
  maxAcademies: number;
  maxRoomsPerMonth: number;
  maxClassHoursPerMonth: number;
  maxReportsPerMonth: number;
  maxStudentsPerRoom: number;
  maxStorageBytes: number;
  maxAiTokensPerMonth: number;
}> = {
  [UserPlan.FREE]: {
    maxAcademies: 1,
    maxRoomsPerMonth: 10,
    maxClassHoursPerMonth: 5,
    maxReportsPerMonth: 5,
    maxStudentsPerRoom: 2,
    maxStorageBytes: 1_073_741_824, // 1GB
    maxAiTokensPerMonth: 50_000,
  },
  [UserPlan.STARTER]: {
    maxAcademies: 3,
    maxRoomsPerMonth: 50,
    maxClassHoursPerMonth: 25,
    maxReportsPerMonth: 50,
    maxStudentsPerRoom: 8,
    maxStorageBytes: 10_737_418_240, // 10GB
    maxAiTokensPerMonth: 500_000,
  },
  [UserPlan.PROFESSIONAL]: {
    maxAcademies: 10,
    maxRoomsPerMonth: 200,
    maxClassHoursPerMonth: 100,
    maxReportsPerMonth: 200,
    maxStudentsPerRoom: 25,
    maxStorageBytes: 53_687_091_200, // 50GB
    maxAiTokensPerMonth: 2_000_000,
  },
  [UserPlan.ENTERPRISE]: {
    maxAcademies: 999,
    maxRoomsPerMonth: 999999,
    maxClassHoursPerMonth: 999999,
    maxReportsPerMonth: 999999,
    maxStudentsPerRoom: 50,
    maxStorageBytes: 536_870_912_000, // 500GB
    maxAiTokensPerMonth: 999_999_999,
  },
};
