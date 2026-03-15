// ─── Requests ───────────────────────────────────────

export interface InviteTeacherRequest {
  email: string;
}

// ─── Responses ──────────────────────────────────────

export interface TeacherResponse {
  id: string;
  name: string;
  email: string;
  languages: string[];
  isActive: boolean;
  userId: string | null;
  createdAt: string;
}

export interface TeacherDetailResponse {
  id: string;
  name: string;
  email: string;
  languages: string[];
  isActive: boolean;
  userId: string | null;
  createdAt: string;
  totalClasses: number;
  totalMinutes: number;
  completedClasses: number;
  cancelledClasses: number;
  cancelRate: number;
  avgDuration: number;
  uniqueStudents: number;
  noShowRate: number;
  languagesTaught: string[];
  lastClassAt: string | null;
  aiReportsCount: number;
  recentClasses: Array<{
    classId: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    classType: string;
    students: string;
    language: string;
  }>;
  monthlyHours: Array<{
    month: string;
    hours: number;
  }>;
  weeklyActivity: Array<{
    week: string;
    classes: number;
  }>;
  studentLevelDistribution: Array<{
    level: string;
    count: number;
  }>;
}

export interface InviteTeacherResponse {
  id: string;
  name: string;
  email: string;
  languages: string[];
  isActive: boolean;
}
