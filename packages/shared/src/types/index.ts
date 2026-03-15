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

// ─── Team Roles (SaaS Staff) ──────────────────────────────

export enum TeamRole {
  ADMIN = "admin",
  CONTENT_MANAGER = "content_manager",
  FINANCING = "financing",
  COORDINATOR = "coordinator",
}

// ─── Permissions ──────────────────────────────────────────

export enum Permission {
  CLASSES_VIEW = "classes:view",
  CLASSES_CREATE = "classes:create",
  CLASSES_EDIT = "classes:edit",
  CLASSES_CANCEL = "classes:cancel",

  COURSES_VIEW = "courses:view",
  COURSES_MANAGE = "courses:manage",

  LESSONS_VIEW = "lessons:view",
  LESSONS_MANAGE = "lessons:manage",

  EXERCISES_VIEW = "exercises:view",
  EXERCISES_MANAGE = "exercises:manage",

  LEARNING_PATHS_VIEW = "learning_paths:view",
  LEARNING_PATHS_MANAGE = "learning_paths:manage",

  MEDIA_VIEW = "media:view",
  MEDIA_MANAGE = "media:manage",

  STUDENTS_VIEW = "students:view",
  STUDENTS_CREATE = "students:create",
  STUDENTS_DEACTIVATE = "students:deactivate",

  TEACHERS_VIEW = "teachers:view",
  TEACHERS_APPROVE = "teachers:approve",

  FINANCINGS_VIEW_KPIS = "financings:view_kpis",
  FINANCINGS_MANAGE_PLANS = "financings:manage_plans",

  TEAM_VIEW = "team:view",
  TEAM_INVITE = "team:invite",
  TEAM_EDIT_ROLES = "team:edit_roles",

  INTEGRATIONS_VIEW = "integrations:view",
  INTEGRATIONS_MANAGE = "integrations:manage",

  ACADEMY_SETTINGS = "academy:settings",
}

export const ROLE_TEMPLATES: Record<TeamRole, Permission[]> = {
  [TeamRole.ADMIN]: Object.values(Permission),
  [TeamRole.CONTENT_MANAGER]: [
    Permission.COURSES_VIEW,
    Permission.COURSES_MANAGE,
    Permission.LESSONS_VIEW,
    Permission.LESSONS_MANAGE,
    Permission.EXERCISES_VIEW,
    Permission.EXERCISES_MANAGE,
    Permission.LEARNING_PATHS_VIEW,
    Permission.LEARNING_PATHS_MANAGE,
    Permission.MEDIA_VIEW,
    Permission.MEDIA_MANAGE,
    Permission.CLASSES_VIEW,
  ],
  [TeamRole.FINANCING]: [
    Permission.FINANCINGS_VIEW_KPIS,
    Permission.FINANCINGS_MANAGE_PLANS,
    Permission.STUDENTS_VIEW,
  ],
  [TeamRole.COORDINATOR]: [
    Permission.CLASSES_VIEW,
    Permission.CLASSES_CREATE,
    Permission.CLASSES_EDIT,
    Permission.CLASSES_CANCEL,
    Permission.STUDENTS_VIEW,
    Permission.STUDENTS_CREATE,
    Permission.STUDENTS_DEACTIVATE,
    Permission.TEACHERS_VIEW,
    Permission.TEACHERS_APPROVE,
  ],
};

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
  PODCAST = "podcast",
  GUIDED_STORY = "guided_story",
  GUIDED_CONVERSATION = "guided_conversation",
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

// ─── Academy Plans (for students) ─────────────────────

export enum AcademyPlanPeriodicity {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  ANNUAL = "annual",
}

export enum StudentSubscriptionStatus {
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

// ─── Teacher Application ─────────────────────────────

export enum TeacherApplicationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

// ─── Course ──────────────────────────────────────────

export enum CourseStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

// ─── Onboarding ──────────────────────────────────────

export enum OnboardingStep {
  OVERVIEW = "overview",
  CLASSES = "classes",
  COURSES = "courses",
  LESSONS = "lessons",
  EXERCISES = "exercises",
  LEARNING_PATHS = "learning_paths",
  MEDIA_LIBRARY = "media_library",
  STUDENTS = "students",
  TEACHERS = "teachers",
  FINANCINGS = "financings",
  TEAM = "team",
  INTEGRATIONS = "integrations",
}

// ─── Media ─────────────────────────────────────────

export enum MediaStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
}

export enum ChunkType {
  VOCABULARY_LIST = "vocabulary_list",
  DIALOGUE = "dialogue",
  GRAMMAR_EXPLANATION = "grammar_explanation",
  READING_PASSAGE = "reading_passage",
  EXERCISE = "exercise",
  INSTRUCTIONS = "instructions",
  CULTURAL_NOTE = "cultural_note",
  IMAGE_DESCRIPTION = "image_description",
  OTHER = "other",
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
  studentPreview: string;
}> = {
  [ExerciseType.WARM_UP]: {
    label: "Warm Up",
    description: "Free text exercise from text, audio, or video",
    icon: "Flame",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Students read a text passage and write a free-text response (opinion, reflection, or short answer). Includes a model answer for comparison.",
  },
  [ExerciseType.INTRO]: {
    label: "Introduction",
    description: "Presentation screen for topic/structure overview",
    icon: "BookOpen",
    needsAudio: false,
    needsVideo: false,
    isInteractive: false,
    studentPreview: "Read-only presentation card with topic overview and key concepts. No student interaction.",
  },
  [ExerciseType.CARD]: {
    label: "Concept Card",
    description: "Grammar/concept card with structure and examples",
    icon: "CreditCard",
    needsAudio: false,
    needsVideo: false,
    isInteractive: false,
    studentPreview: "Read-only reference card with grammar rules, vocabulary, or concept explanations with examples.",
  },
  [ExerciseType.TAP_TO_COMPLETE]: {
    label: "Tap to Complete",
    description: "Complete a sentence by tapping the correct option",
    icon: "MousePointerClick",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Sentence with blanks (___) and tappable word options. Student taps the correct word to fill each blank.",
  },
  [ExerciseType.TAP_TO_ORDER]: {
    label: "Tap to Order",
    description: "Reorder shuffled words to form a correct sentence",
    icon: "ArrowUpDown",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Shuffled words that students reorder by tapping to form a correct sentence.",
  },
  [ExerciseType.LISTEN_MATCH]: {
    label: "Listen & Match",
    description: "Listen to audio and match items together",
    icon: "AudioLines",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Audio clip + matching pairs (e.g., word-definition). Student listens then connects matching items.",
  },
  [ExerciseType.LISTEN_REPEAT]: {
    label: "Listen & Repeat",
    description: "Listen to audio and record yourself repeating it",
    icon: "Mic",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Audio clip of a phrase. Student listens and records themselves repeating it.",
  },
  [ExerciseType.WATCH_REFLECT]: {
    label: "Watch & Reflect",
    description: "Watch a video and write a reflection",
    icon: "Video",
    needsAudio: false,
    needsVideo: true,
    isInteractive: true,
    studentPreview: "Video clip + reflection prompt. Student watches then writes a free-text response.",
  },
  [ExerciseType.COMPLETE_CHAT]: {
    label: "Complete Chat",
    description: "Fill in blanks within a chat conversation",
    icon: "MessageSquare",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Chat conversation (A/B dialogue) with blanks in some lines. Student taps correct responses from options.",
  },
  [ExerciseType.WRITE_COMPLETE]: {
    label: "Write to Complete",
    description: "Type words/phrases to fill blanks in text",
    icon: "PenLine",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Text with blanks (___) where students type the missing words/phrases (no options provided).",
  },
  [ExerciseType.LISTEN_COMPLETE]: {
    label: "Listen & Complete",
    description: "Listen to audio and complete a conversation with blanks",
    icon: "Headphones",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Audio clip + dialogue with blanks. Student listens then fills blanks by tapping from word options.",
  },
  [ExerciseType.PODCAST]: {
    label: "Podcast",
    description: "Listen to a podcast episode and answer comprehension questions",
    icon: "Podcast",
    needsAudio: true,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Podcast-style audio (HOST/GUEST dialogue) with transcript. Student answers multiple-choice comprehension questions.",
  },
  [ExerciseType.GUIDED_STORY]: {
    label: "Guided Story",
    description: "Participate in building a story by choosing directions and filling in words",
    icon: "BookHeart",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Interactive story with fill-in blanks and branching choice points (a/b/c). Student shapes the narrative.",
  },
  [ExerciseType.GUIDED_CONVERSATION]: {
    label: "Guided Conversation",
    description: "Practice a real conversation by filling in your part of the dialogue",
    icon: "MessagesSquare",
    needsAudio: false,
    needsVideo: false,
    isInteractive: true,
    studentPreview: "Realistic dialogue where student fills in their part (YOU: lines) by typing responses. Includes contextual hints.",
  },
};

// ─── Student App ─────────────────────────────────────────

export enum StudentProgressSource {
  LESSON = "lesson",
  REVIEW = "review",
  HOMEWORK = "homework",
  PRACTICE = "practice",
}

export enum LessonProgressStatus {
  NOT_STARTED = "not_started",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export enum ReviewItemType {
  VOCABULARY = "vocabulary",
  GRAMMAR = "grammar",
  EXERCISE = "exercise",
}

export enum ReviewSourceType {
  CLASS_REPORT = "class_report",
  LESSON = "lesson",
  MANUAL = "manual",
}

export enum UserType {
  STAFF = "staff",
  STUDENT = "student",
}

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
  maxClassesPerMonth: number;
  maxClassHoursPerMonth: number;
  maxReportsPerMonth: number;
  maxStudentsPerRoom: number;
  maxStorageBytes: number;
  maxAiTokensPerMonth: number;
  maxTtsCharactersPerMonth: number;
  integrations: boolean;
  academyLanding: boolean;
}> = {
  [UserPlan.FREE]: {
    maxAcademies: 1,
    maxClassesPerMonth: 10,
    maxClassHoursPerMonth: 10,
    maxReportsPerMonth: 999_999,
    maxStudentsPerRoom: 2,
    maxStorageBytes: 5_368_709_120, // 5GB
    maxAiTokensPerMonth: 50_000,
    maxTtsCharactersPerMonth: 10_000,
    integrations: false,
    academyLanding: false,
  },
  [UserPlan.STARTER]: {
    maxAcademies: 3,
    maxClassesPerMonth: 50,
    maxClassHoursPerMonth: 25,
    maxReportsPerMonth: 999_999,
    maxStudentsPerRoom: 8,
    maxStorageBytes: 10_737_418_240, // 10GB
    maxAiTokensPerMonth: 500_000,
    maxTtsCharactersPerMonth: 100_000,
    integrations: false,
    academyLanding: false,
  },
  [UserPlan.PROFESSIONAL]: {
    maxAcademies: 10,
    maxClassesPerMonth: 200,
    maxClassHoursPerMonth: 100,
    maxReportsPerMonth: 999_999,
    maxStudentsPerRoom: 25,
    maxStorageBytes: 53_687_091_200, // 50GB
    maxAiTokensPerMonth: 2_000_000,
    maxTtsCharactersPerMonth: 500_000,
    integrations: true,
    academyLanding: false,
  },
  [UserPlan.ENTERPRISE]: {
    maxAcademies: 999,
    maxClassesPerMonth: 999_999,
    maxClassHoursPerMonth: 999_999,
    maxReportsPerMonth: 999_999,
    maxStudentsPerRoom: 50,
    maxStorageBytes: 536_870_912_000, // 500GB
    maxAiTokensPerMonth: 999_999_999,
    maxTtsCharactersPerMonth: 999_999_999,
    integrations: true,
    academyLanding: true,
  },
};
