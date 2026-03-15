// ─── Auth ───────────────────────────────────────────────

export interface StudentRegisterRequest {
  email: string;
  password: string;
  name: string;
  academyId: string;
}

export interface StudentLoginRequest {
  email: string;
  password: string;
  academyId: string;
}

export interface StudentAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
  student: { id: string; academyId: string; onboardingCompleted?: boolean };
}

export interface AcademyInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  academyType: string;
  settings: Record<string, unknown>;
}

// ─── Onboarding ─────────────────────────────────────────

export interface StudentOnboardingRequest {
  nativeLanguage?: string;
  learningLanguage?: string;
  selfAssessedLevel?: string;
  learningGoal?: string;
  occupation?: string;
  interests?: string[];
  dailyGoalMinutes?: number;
  referralSource?: string;
  timezone?: string;
}

export interface SwitchLanguageRequest {
  learningLanguage: string;
}

// ─── Home ───────────────────────────────────────────────

export interface StudentHome {
  streak: {
    currentStreak: number;
    longestStreak: number;
    freezesAvailable: number;
  };
  today: {
    exercisesCompleted: number;
    minutesPracticed: number;
    xpEarned: number;
  };
  reviewDueCount: number;
  dailyGoalMinutes: number;
  nextClass: {
    id: string;
    title: string;
    scheduledAt: string;
  } | null;
  continueLesson: {
    lessonId: string;
    title: string;
    completedExercises: number;
    totalExercises: number;
    lastExerciseIndex: number;
  } | null;
  recommendedCourse: {
    id: string;
    title: string;
    level: string | null;
  } | null;
}

// ─── Study ──────────────────────────────────────────────

export interface StudentCourse {
  id: string;
  title: string;
  description: string;
  language: string;
  level: string;
  status: string;
  completedLessons: number;
  totalLessons: number;
}

export interface StudentCourseDetail {
  id: string;
  title: string;
  description: string;
  language: string;
  level: string;
  lessons: {
    id: string;
    title: string;
    module: string | null;
    orderIndex: number;
    status: string;
    completedExercises: number;
    totalExercises: number;
  }[];
}

export interface StudentLessonRunner {
  lessonId: string;
  progress: {
    completedExercises: number;
    totalExercises: number;
    lastExerciseIndex: number;
    status: string;
  };
  exercises: {
    id: string;
    type: string;
    title: string;
    content: Record<string, unknown>;
    orderIndex: number;
  }[];
}

export interface SubmitExerciseRequest {
  answer?: string;
  isCorrect?: boolean;
  timeSpentSeconds: number;
  lessonId?: string;
}

export interface SubmitExerciseResponse {
  xp: number;
  isCorrect: boolean | null;
}

// ─── Review ─────────────────────────────────────────────

export interface ReviewStats {
  dueToday: number;
  total: number;
  mastered: number;
}

export interface ReviewItemResponse {
  id: string;
  itemType: string;
  content: Record<string, unknown>;
  sourceType: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string;
}

export interface SubmitReviewRequest {
  quality: number;
}

export interface SubmitReviewResponse {
  nextReviewDate: string;
  interval: number;
  isRetired: boolean;
  xp: number;
}

// ─── Classes ────────────────────────────────────────────

export interface StudentClassItem {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number;
  type: string;
  teacher: { id: string; name: string } | null;
}

export interface StudentClassReport {
  classId: string;
  summary: string;
  studentReport: Record<string, unknown> | null;
}

// ─── Profile ────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  profileImageUrl: string | null;
  learningLanguage: string | null;
  nativeLanguage: string | null;
  selfAssessedLevel: string | null;
  learningGoal: string | null;
  occupation: string | null;
  interests: string[];
  dailyGoalMinutes: number;
  timezone: string | null;
  onboardingCompleted: boolean;
  streak: { currentStreak: number; longestStreak: number };
  totalXp: number;
}

export interface UpdateStudentProfileRequest {
  name?: string;
  profileImageUrl?: string;
  dailyGoalMinutes?: number;
  timezone?: string;
}

export interface UpdatePreferencesRequest {
  nativeLanguage?: string;
  learningLanguage?: string;
  selfAssessedLevel?: string;
  learningGoal?: string;
  occupation?: string;
  interests?: string[];
  dailyGoalMinutes?: number;
}

export interface StudentProgressData {
  heatmap: {
    date: string;
    xp: number;
    exercises: number;
    minutes: number;
  }[];
}

// ─── Learning Path ─────────────────────────────────────

export interface StudentLearningPathCourseItem {
  id: string;
  title: string;
  description: string | null;
  level: string;
  language: string;
  thumbnailUrl: string | null;
  isLocked: boolean;
  sortOrder: number;
  addedAt: string;
  status: string;
  completedLessons: number;
  totalLessons: number;
}

export interface StudentLearningPathResponse {
  status: "ready" | "not_ready";
  id?: string;
  generatedAt?: string;
  courses: StudentLearningPathCourseItem[];
}

// ─── Streak ─────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  totalActivityDays: number;
}
