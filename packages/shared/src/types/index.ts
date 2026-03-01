export enum UserRole {
  ADMIN = "admin",
  TEACHER = "teacher",
  STUDENT = "student",
}

export enum ClassroomType {
  ONE_TO_ONE = "one_to_one",
  GROUP = "group",
}

export enum SessionStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum Speaker {
  TEACHER = "teacher",
  STUDENT = "student",
}

export enum AcademyPlan {
  FREE = "free",
  STARTER = "starter",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

export interface IAcademy {
  id: string;
  name: string;
  slug: string;
  plan: AcademyPlan;
  settings: Record<string, unknown>;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  academyId: string;
  profileImageUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IClassroom {
  id: string;
  academyId: string;
  teacherId: string;
  name: string;
  description?: string;
  type: ClassroomType;
  languageTarget: string;
  maxStudents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISession {
  id: string;
  academyId: string;
  classroomId: string;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  status: SessionStatus;
  livekitRoomId?: string;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITranscription {
  id: string;
  academyId: string;
  sessionId: string;
  speaker: Speaker;
  text: string;
  timestampStart: number;
  timestampEnd: number;
  wordTimestamps: Record<string, unknown>[];
  languageDetected?: string;
  createdAt: Date;
}

export interface IClassReport {
  id: string;
  academyId: string;
  sessionId: string;
  summary: string;
  vocabulary: Record<string, unknown>[];
  grammarErrors: Record<string, unknown>[];
  speakingMetrics: Record<string, unknown>;
  suggestions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ILearningProfile {
  id: string;
  academyId: string;
  studentId: string;
  vocabularyBank: Record<string, unknown>[];
  grammarPatterns: Record<string, unknown>[];
  cefrLevelEstimate?: string;
  updatedAt: Date;
}

export interface IProgressReport {
  id: string;
  academyId: string;
  studentId: string;
  classroomId: string;
  periodStart: Date;
  periodEnd: Date;
  scores: Record<string, unknown>;
  teacherComments?: string;
  createdAt: Date;
}
