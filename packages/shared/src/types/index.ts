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
  PLANNER = "planner",
  CONTENT_CREATOR = "content_creator",
  STAFF = "staff",
}

// ─── Academy Type ──────────────────────────────────────────

export enum AcademyType {
  ACADEMY = "academy",
  FREELANCE = "freelance",
}

// ─── Class ──────────────────────────────────────────────

export enum ClassStatus {
  SCHEDULED = "scheduled",
  CONFIRMED = "confirmed",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum ClassType {
  INDIVIDUAL = "individual",
  GROUP = "group",
}

export enum ClassStudentStatus {
  ENROLLED = "enrolled",
  ATTENDED = "attended",
  NO_SHOW = "no_show",
  CANCELLED = "cancelled",
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
  WARM_UP = "warm_up",
  INTRO = "intro",
  CARD = "card",
  TAP_TO_COMPLETE = "tap_to_complete",
  TAP_TO_ORDER = "tap_to_order",
  LISTEN_MATCH = "listen_match",
  LISTEN_REPEAT = "listen_repeat",
  WATCH_REFLECT = "watch_reflect",
  COMPLETE_CHAT = "complete_chat",
  WRITE_COMPLETE = "write_complete",
  LISTEN_COMPLETE = "listen_complete",
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

// ─── Learning Path ──────────────────────────────────

export enum LearningPathStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

// ─── Lesson ─────────────────────────────────────────

export enum LessonStatus {
  DRAFT = "draft",
  READY = "ready",
  COMPLETED = "completed",
}

// ─── Media ─────────────────────────────────────────

export enum MediaStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
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

export const EXERCISE_TYPE_CONFIG: Record<ExerciseType, {
  label: string;
  description: string;
  icon: string;
  needsAudio: boolean;
  needsVideo: boolean;
  isInteractive: boolean;
}> = {
  [ExerciseType.WARM_UP]: {
    label: "Warm Up",
    description: "Free text exercise from text, audio, or video",
    icon: "Flame",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.INTRO]: {
    label: "Introduction",
    description: "Presentation screen for topic/structure overview",
    icon: "BookOpen",
    needsAudio: false,
    needsVideo: false,
    isInteractive: false,
  },
  [ExerciseType.CARD]: {
    label: "Concept Card",
    description: "Grammar/concept card with structure and examples",
    icon: "CreditCard",
    needsAudio: false,
    needsVideo: false,
    isInteractive: false,
  },
  [ExerciseType.TAP_TO_COMPLETE]: {
    label: "Tap to Complete",
    description: "Complete a sentence by tapping the correct option",
    icon: "MousePointerClick",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.TAP_TO_ORDER]: {
    label: "Tap to Order",
    description: "Reorder shuffled words to form a correct sentence",
    icon: "ArrowUpDown",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.LISTEN_MATCH]: {
    label: "Listen & Match",
    description: "Listen to audio and match items together",
    icon: "AudioLines",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.LISTEN_REPEAT]: {
    label: "Listen & Repeat",
    description: "Listen to audio and record yourself repeating it",
    icon: "Mic",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.WATCH_REFLECT]: {
    label: "Watch & Reflect",
    description: "Watch a video and write a reflection",
    icon: "Video",
    needsAudio: false,
    needsVideo: true,
    isInteractive: true,
  },
  [ExerciseType.COMPLETE_CHAT]: {
    label: "Complete Chat",
    description: "Fill in blanks within a chat conversation",
    icon: "MessageSquare",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.WRITE_COMPLETE]: {
    label: "Write to Complete",
    description: "Type words/phrases to fill blanks in text",
    icon: "PenLine",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
  },
  [ExerciseType.LISTEN_COMPLETE]: {
    label: "Listen & Complete",
    description: "Listen to audio and complete a conversation with blanks",
    icon: "Headphones",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
  },
};

// ─── Usage ───────────────────────────────────────────────

export enum UsageMetric {
  ROOMS_CREATED = "rooms_created",
  CLASS_MINUTES = "class_minutes",
  AI_REPORTS = "ai_reports",
  AI_TOKENS = "ai_tokens",
  TTS_CHARACTERS = "tts_characters",
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
  maxTtsCharactersPerMonth: number;
}> = {
  [UserPlan.FREE]: {
    maxAcademies: 1,
    maxRoomsPerMonth: 10,
    maxClassHoursPerMonth: 5,
    maxReportsPerMonth: 5,
    maxStudentsPerRoom: 2,
    maxStorageBytes: 1_073_741_824, // 1GB
    maxAiTokensPerMonth: 50_000,
    maxTtsCharactersPerMonth: 10_000,
  },
  [UserPlan.STARTER]: {
    maxAcademies: 3,
    maxRoomsPerMonth: 50,
    maxClassHoursPerMonth: 25,
    maxReportsPerMonth: 50,
    maxStudentsPerRoom: 8,
    maxStorageBytes: 10_737_418_240, // 10GB
    maxAiTokensPerMonth: 500_000,
    maxTtsCharactersPerMonth: 100_000,
  },
  [UserPlan.PROFESSIONAL]: {
    maxAcademies: 10,
    maxRoomsPerMonth: 200,
    maxClassHoursPerMonth: 100,
    maxReportsPerMonth: 200,
    maxStudentsPerRoom: 25,
    maxStorageBytes: 53_687_091_200, // 50GB
    maxAiTokensPerMonth: 2_000_000,
    maxTtsCharactersPerMonth: 500_000,
  },
  [UserPlan.ENTERPRISE]: {
    maxAcademies: 999,
    maxRoomsPerMonth: 999999,
    maxClassHoursPerMonth: 999999,
    maxReportsPerMonth: 999999,
    maxStudentsPerRoom: 50,
    maxStorageBytes: 536_870_912_000, // 500GB
    maxAiTokensPerMonth: 999_999_999,
    maxTtsCharactersPerMonth: 999_999_999,
  },
};
