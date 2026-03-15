import type { PaginationParams } from "./common";

// ─── Requests ───────────────────────────────────────

export interface QueryStudentsParams extends PaginationParams {
  search?: string;
  includeInactive?: boolean;
}

export interface CreateStudentRequest {
  name: string;
  email: string;
  cefrEstimate?: string;
}

// ─── Responses ──────────────────────────────────────

export interface StudentResponse {
  id: string;
  email: string;
  name: string;
  totalRooms: number;
  totalMinutes: number;
  cefrEstimate: string | null;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface StudentDetailResponse extends StudentResponse {
  lastConnection: string | null;
  totalSpeakingSeconds: number;
  attendedClasses: number;
  streak: {
    currentStreak: number;
    longestStreak: number;
    totalActivityDays: number;
  } | null;
  totalXp: number;
  nativeLanguage: string | null;
  learningLanguage: string | null;
  selfAssessedLevel: string | null;
  learningGoal: string | null;
  occupation: string | null;
  interests: string[];
  dailyGoalMinutes: number;
  onboardingCompleted: boolean;
  teachers: Array<{ id: string; name: string }>;
  classHistory: Array<{
    classId: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    teacherName: string | null;
    language: string;
  }>;
  weeklyActivity: Array<{
    week: string;
    classes: number;
  }>;
  aiReports: Array<{
    reportId: string;
    roomId: string;
    roomTitle: string | null;
    summary: string | null;
    speakingTime: number;
    speakingRatio: number;
    fillerWords: number;
    vocabularyCount: number;
    grammarErrorCount: number;
    createdAt: string;
  }>;
  activeSubscription: {
    id: string;
    planName: string;
    planPrice: number;
    currency: string;
    periodicity: string | null;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    createdAt: string;
  } | null;
  subscriptionHistory: Array<{
    id: string;
    planName: string;
    planPrice: number;
    currency: string;
    status: string;
    createdAt: string;
    cancelledAt: string | null;
  }>;
  exercises: Array<{
    id: string | undefined;
    type: string | undefined;
    targetSkill: string | undefined;
    topic: string | undefined;
    cefrLevel: string | undefined;
    source: string | undefined;
    isCompleted: boolean;
    isCorrect: boolean | null;
    studentAnswer: string | null;
    reportId: string;
    createdAt: string;
  }>;
}
