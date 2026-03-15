import type { ExerciseResponse } from "./exercises";

// ─── Query params ────────────────────────────────────

export interface QueryMyClassesParams {
  status?: string;
  from?: string;
  to?: string;
  classType?: string;
  limit?: number;
  offset?: number;
}

export interface QueryMyReportsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

// ─── Responses ───────────────────────────────────────

export interface MyStats {
  upcomingClasses: number;
  completedClasses: number;
  totalReports: number;
  nextClass: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
  } | null;
}

export interface MyClassListItem {
  id: string;
  title: string;
  description: string | null;
  classType: string;
  status: string;
  language: string;
  maxStudents: number;
  scheduledAt: string;
  durationMinutes: number;
  academyName: string;
  teacher: { id: string; name: string } | null;
  roomId: string | null;
}

export interface MyClassesList {
  data: MyClassListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MyClassDetail {
  id: string;
  title: string;
  description: string | null;
  classType: string;
  status: string;
  language: string;
  maxStudents: number;
  scheduledAt: string;
  durationMinutes: number;
  cancellationMinutes: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  academyName: string;
  teacher: { id: string; name: string; email: string } | null;
  students: { id: string; email: string; name: string; status: string }[];
  lesson: { id: string; title: string } | null;
  room: { id: string; status: string } | null;
  teacherUrl: string;
  studentUrl: string;
  createdAt: string;
  updatedAt: string;
  reportId: string | null;
}

export interface MyReportListItem {
  id: string;
  status: string;
  summary: string | null;
  classDuration: number;
  studentCount: number;
  class: { id: string; title: string; scheduledAt: string } | null;
  createdAt: string;
}

export interface MyReportsList {
  data: MyReportListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MyReportDetail {
  id: string;
  status: string;
  summary: string | null;
  classDuration: number;
  tokensUsed: number;
  teacher: { name: string; speakingTime: number; speakingRatio: number } | null;
  studentReports: {
    studentId: string;
    name: string;
    email: string;
    speakingTime: number;
    speakingRatio: number;
    fillerWords: number;
    vocabulary: { word: string; cefrLevel: string; context: string }[];
    grammarErrors: { text: string; correction: string; rule: string; explanation: string }[];
    exercises: Record<string, unknown>[];
    homeworkSuggestions: string[];
  }[];
  class: { id: string; title: string; scheduledAt: string; language: string };
  academyName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyAcademyMembership {
  memberId: string;
  roles: string[];
  academy: {
    id: string;
    name: string;
    slug: string;
    academyType: string;
  };
  joinedAt: string;
}

// ─── Exercise / Lesson query params ──────────────────

export interface QueryMyExercisesParams {
  language?: string;
  cefrLevel?: string;
  type?: string;
  targetSkill?: string;
  limit?: number;
  offset?: number;
}

export interface QueryMyLessonsParams {
  language?: string;
  cefrLevel?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ─── Exercise / Lesson responses ─────────────────────

export interface MyExercisesList {
  data: ExerciseResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface MyLessonListItem {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  exerciseCount: number;
  academyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyLessonsList {
  data: MyLessonListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MyLessonDetail {
  id: string;
  title: string;
  description: string | null;
  language: string;
  cefrLevel: string;
  status: string;
  exercises: (ExerciseResponse & { sortOrder: number })[];
  academyId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Notification query params ───────────────────────

export interface QueryMyNotificationsParams {
  limit?: number;
  offset?: number;
}

// ─── Notification responses ──────────────────────────

export interface MyNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  createdAt: string;
}

export interface MyNotificationsList {
  data: MyNotification[];
  unreadCount: number;
  total: number;
  limit: number;
  offset: number;
}

// ─── Student query params ───────────────────────────

export interface QueryMyStudentsParams {
  academyId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Student responses ──────────────────────────────

export interface MyStudentListItem {
  id: string;
  name: string;
  email: string;
  academyId: string;
  academyName: string;
  cefrEstimate: string | null;
  isActive: boolean;
  totalClasses: number;
  lastClassAt: string | null;
}

export interface MyStudentsList {
  data: MyStudentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface MyStudentDetail {
  id: string;
  name: string;
  email: string;
  academyName: string;
  cefrEstimate: string | null;
  isActive: boolean;
  totalClasses: number;
  totalMinutes: number;
  classes: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    classType: string;
    reportId: string | null;
  }[];
}
