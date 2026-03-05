import "reflect-metadata";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import {
  UserPlan,
  AcademyRole,
  AcademyType,
  ClassStatus,
  ClassType,
  ClassStudentStatus,
  RoomStatus,
  ParticipantRole,
  ReportStatus,
  ExerciseSource,
  LearningPathStatus,
  LessonStatus,
  MediaStatus,
  UsageMetric,
} from "@langopia/shared/types";

// ─── User ─────────────────────────────────────────────────

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: "enum", enum: UserPlan, default: UserPlan.FREE })
  plan!: UserPlan;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeSubscriptionId!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: "jsonb", default: [] })
  fcmTokens!: { token: string; platform: string; createdAt: string }[];

  @OneToMany(() => AcademyMember, (m) => m.user)
  academyMemberships!: AcademyMember[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── Academy ──────────────────────────────────────────────

@Entity("academies")
export class Academy {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  slug!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  apiKey!: string;

  @Column({ type: "varchar", length: 20, default: "academy" })
  academyType!: string;

  @Column({ type: "jsonb", default: {} })
  settings!: Record<string, unknown>;

  @OneToMany(() => AcademyMember, (m) => m.academy)
  members!: AcademyMember[];

  @OneToMany(() => Student, (s) => s.academy)
  students!: Student[];

  @OneToMany(() => Room, (r) => r.academy)
  rooms!: Room[];

  @OneToMany(() => Class, (c) => c.academy)
  classes!: Class[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── AcademyMember (User ↔ Academy many-to-many) ─────────

@Entity("academy_members")
@Unique(["userId", "academyId"])
export class AcademyMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "jsonb", default: ["teacher"] })
  roles!: string[];

  @ManyToOne(() => User, (u) => u.academyMemberships)
  @JoinColumn({ name: "userId" })
  user!: User;

  @ManyToOne(() => Academy, (a) => a.members)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  joinedAt!: Date;
}

// ─── Student (email-based, no account) ───────────────────

@Entity("students")
@Unique(["academyId", "email"])
export class Student {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "int", default: 0 })
  totalRooms!: number;

  @Column({ type: "int", default: 0 })
  totalMinutes!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  cefrEstimate!: string | null;

  @ManyToOne(() => Academy, (a) => a.students)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => RoomParticipant, (p) => p.student)
  participations!: RoomParticipant[];

  @CreateDateColumn({ type: "timestamptz" })
  firstSeenAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  lastSeenAt!: Date;
}

// ─── Lesson ─────────────────────────────────────────

@Entity("lessons")
export class Lesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 10, default: "en" })
  language!: string;

  @Column({ type: "varchar", length: 10 })
  cefrLevel!: string;

  @Column({ type: "enum", enum: LessonStatus, default: LessonStatus.DRAFT })
  status!: LessonStatus;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => LessonExercise, (le) => le.lesson)
  lessonExercises!: LessonExercise[];

  @OneToMany(() => LearningPathLesson, (lpl) => lpl.lesson)
  learningPathLessons!: LearningPathLesson[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── LearningPath ─────────────────────────────────────────

@Entity("learning_paths")
export class LearningPath {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 10 })
  language!: string;

  @Column({ type: "varchar", length: 5 })
  cefrLevel!: string;

  @Column({ type: "enum", enum: LearningPathStatus, default: LearningPathStatus.DRAFT })
  status!: LearningPathStatus;

  @Column({ type: "varchar", length: 500, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "float", nullable: true })
  estimatedHours!: number | null;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => LearningPathLesson, (lpl) => lpl.learningPath)
  learningPathLessons!: LearningPathLesson[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── LearningPathLesson (LearningPath ↔ Lesson join) ─────

@Entity("learning_path_lessons")
@Unique(["learningPathId", "lessonId"])
export class LearningPathLesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  learningPathId!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne(() => LearningPath, (lp) => lp.learningPathLessons, { onDelete: "CASCADE" })
  @JoinColumn({ name: "learningPathId" })
  learningPath!: LearningPath;

  @ManyToOne(() => Lesson, (l) => l.learningPathLessons, { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Class (Scheduled Session) ───────────────────────────

@Entity("classes")
export class Class {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  createdByUserId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 20, default: "individual" })
  classType!: string;

  @Column({ type: "int", default: 1 })
  maxStudents!: number;

  @Column({ type: "varchar", length: 100, default: "en" })
  language!: string;

  @Column({ type: "uuid", nullable: true })
  lessonId!: string | null;

  @Column({ type: "uuid", nullable: true })
  teacherId!: string | null;

  @Column({ type: "varchar", length: 20, default: "scheduled" })
  status!: string;

  @Column({ type: "timestamptz" })
  scheduledAt!: Date;

  @Column({ type: "int", default: 60 })
  durationMinutes!: number;

  @Column({ type: "int", default: 60 })
  cancellationMinutes!: number;

  @Column({ type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: "text", nullable: true })
  cancelReason!: string | null;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  teacherToken!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  studentToken!: string;

  @Column({ type: "uuid", nullable: true })
  roomId!: string | null;

  @ManyToOne(() => Academy, (a) => a.classes)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson | null;

  @ManyToOne(() => AcademyMember, { nullable: true })
  @JoinColumn({ name: "teacherId" })
  teacher!: AcademyMember | null;

  @ManyToOne(() => Room, { nullable: true })
  @JoinColumn({ name: "roomId" })
  room!: Room | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: "createdByUserId" })
  createdBy!: User;

  @OneToMany(() => ClassStudent, (cs) => cs.class_)
  classStudents!: ClassStudent[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── ClassStudent ────────────────────────────────────────

@Entity("class_students")
@Unique(["classId", "studentId"])
export class ClassStudent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  classId!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "varchar", length: 20, default: "enrolled" })
  status!: string;

  @ManyToOne(() => Class, (c) => c.classStudents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "classId" })
  class_!: Class;

  @ManyToOne(() => Student)
  @JoinColumn({ name: "studentId" })
  student!: Student;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Room ─────────────────────────────────────────────────

@Entity("rooms")
export class Room {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  createdByUserId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "varchar", length: 100, default: "en" })
  language!: string;

  @Column({ type: "int", default: 1 })
  maxStudents!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  teacherToken!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  studentToken!: string;

  @Column({ type: "jsonb", default: [] })
  slides!: string[];

  @Column({ type: "enum", enum: RoomStatus, default: RoomStatus.WAITING })
  status!: RoomStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  livekitRoomId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  endedAt!: Date | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  recordingUrl!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  egressId!: string | null;

  @Column({ type: "uuid", nullable: true })
  lessonId!: string | null;

  @Column({ type: "jsonb", nullable: true })
  whiteboardData!: Record<string, unknown> | null;

  @ManyToOne(() => Academy, (a) => a.rooms)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: "createdByUserId" })
  createdBy!: User;

  @OneToMany(() => RoomParticipant, (p) => p.room)
  participants!: RoomParticipant[];

  @OneToMany(() => ChatMessage, (m) => m.room)
  chatMessages!: ChatMessage[];

  @OneToOne(() => RoomNotes, (n) => n.room)
  notes!: RoomNotes | null;

  @OneToMany(() => Transcription, (t) => t.room)
  transcriptions!: Transcription[];

  @OneToOne(() => ClassReport, (r) => r.room)
  report!: ClassReport | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── RoomParticipant ─────────────────────────────────────

@Entity("room_participants")
export class RoomParticipant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  roomId!: string;

  @Column({ type: "uuid", nullable: true })
  studentId!: string | null;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "enum", enum: ParticipantRole })
  role!: ParticipantRole;

  @Column({ type: "int", default: 0 })
  speakingTimeSeconds!: number;

  @Column({ type: "timestamptz", nullable: true })
  leftAt!: Date | null;

  @ManyToOne(() => Room, (r) => r.participants)
  @JoinColumn({ name: "roomId" })
  room!: Room;

  @ManyToOne(() => Student, (s) => s.participations, { nullable: true })
  @JoinColumn({ name: "studentId" })
  student!: Student | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user!: User | null;

  @CreateDateColumn({ type: "timestamptz" })
  joinedAt!: Date;
}

// ─── RoomNotes ───────────────────────────────────────────

@Entity("room_notes")
export class RoomNotes {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  roomId!: string;

  @Column({ type: "jsonb", default: [] })
  vocabulary!: { word: string; definition: string; example: string }[];

  @Column({ type: "jsonb", default: [] })
  corrections!: { error: string; correction: string; context: string }[];

  @Column({ type: "text", default: "" })
  homework!: string;

  @Column({ type: "text", default: "" })
  objectives!: string;

  @OneToOne(() => Room, (r) => r.notes)
  @JoinColumn({ name: "roomId" })
  room!: Room;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── ChatMessage ─────────────────────────────────────────

@Entity("chat_messages")
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  roomId!: string;

  @Column({ type: "varchar", length: 255 })
  senderName!: string;

  @Column({ type: "enum", enum: ParticipantRole })
  senderRole!: ParticipantRole;

  @Column({ type: "text" })
  message!: string;

  @ManyToOne(() => Room, (r) => r.chatMessages)
  @JoinColumn({ name: "roomId" })
  room!: Room;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Transcription ───────────────────────────────────────

@Entity("transcriptions")
export class Transcription {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  roomId!: string;

  @Column({ type: "varchar", length: 255 })
  speakerName!: string;

  @Column({ type: "enum", enum: ParticipantRole })
  speakerRole!: ParticipantRole;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "float" })
  timestampStart!: number;

  @Column({ type: "float" })
  timestampEnd!: number;

  @Column({ type: "jsonb", default: [] })
  wordTimestamps!: Record<string, unknown>[];

  @Column({ type: "varchar", length: 10, nullable: true })
  languageDetected!: string | null;

  @ManyToOne(() => Room, (r) => r.transcriptions)
  @JoinColumn({ name: "roomId" })
  room!: Room;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── ClassReport ─────────────────────────────────────────

@Entity("class_reports")
export class ClassReport {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  roomId!: string;

  @Column({ type: "enum", enum: ReportStatus, default: ReportStatus.PROCESSING })
  status!: ReportStatus;

  @Column({ type: "text", nullable: true })
  summary!: string | null;

  @Column({ type: "int", default: 0 })
  classDuration!: number;

  @Column({ type: "int", default: 0 })
  tokensUsed!: number;

  @Column({ type: "jsonb", nullable: true })
  teacher!: { name: string; speakingTime: number; speakingRatio: number } | null;

  @Column({ type: "jsonb", default: [] })
  studentReports!: {
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

  @OneToOne(() => Room, (r) => r.report)
  @JoinColumn({ name: "roomId" })
  room!: Room;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── Exercise (Bank Item) ────────────────────────────

@Entity("exercises")
export class Exercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 100 })
  type!: string;

  @Column({ type: "varchar", length: 100 })
  targetSkill!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  topic!: string | null;

  @Column({ type: "varchar", length: 10, default: "en" })
  language!: string;

  @Column({ type: "text" })
  instruction!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", nullable: true })
  options!: string[] | null;

  @Column({ type: "text" })
  correctAnswer!: string;

  @Column({ type: "text" })
  explanation!: string;

  @Column({ type: "varchar", length: 10 })
  cefrLevel!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  title!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  audioUrl!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  videoUrl!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  @Column({ type: "vector", length: 1536, nullable: true })
  topicEmbedding!: string | null;

  @Column({ type: "enum", enum: ExerciseSource, default: ExerciseSource.AI_LIVE })
  source!: ExerciseSource;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => LessonExercise, (le) => le.exercise)
  lessonExercises!: LessonExercise[];

  @OneToMany(() => ReportExercise, (re) => re.exercise)
  reportExercises!: ReportExercise[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── LessonExercise (Lesson ↔ Exercise join) ────────

@Entity("lesson_exercises")
@Unique(["lessonId", "exerciseId"])
export class LessonExercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "uuid" })
  exerciseId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne(() => Lesson, (l) => l.lessonExercises, { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson;

  @ManyToOne(() => Exercise, (e) => e.lessonExercises, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exerciseId" })
  exercise!: Exercise;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── ReportExercise (Report ↔ Student ↔ Exercise) ───

@Entity("report_exercises")
export class ReportExercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  reportId!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "uuid" })
  exerciseId!: string;

  @Column({ type: "boolean", default: false })
  isCompleted!: boolean;

  @Column({ type: "boolean", nullable: true })
  isCorrect!: boolean | null;

  @Column({ type: "text", nullable: true })
  studentAnswer!: string | null;

  @ManyToOne(() => ClassReport, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reportId" })
  report!: ClassReport;

  @ManyToOne(() => Student)
  @JoinColumn({ name: "studentId" })
  student!: Student;

  @ManyToOne(() => Exercise, (e) => e.reportExercises, { onDelete: "CASCADE" })
  @JoinColumn({ name: "exerciseId" })
  exercise!: Exercise;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── UsageRecord ─────────────────────────────────────────

@Entity("usage_records")
@Unique(["userId", "academyId", "period", "metric"])
export class UsageRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 7 })
  period!: string; // "YYYY-MM"

  @Column({ type: "enum", enum: UsageMetric })
  metric!: UsageMetric;

  @Column({ type: "bigint", default: 0 })
  value!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;
}

// ─── MediaItem ──────────────────────────────────────

@Entity("media_items")
@Unique(["academyId", "contentHash"])
export class MediaItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  uploadedByUserId!: string;

  @Column({ type: "varchar", length: 500 })
  filename!: string;

  @Column({ type: "varchar", length: 100 })
  mimeType!: string;

  @Column({ type: "int" })
  fileSize!: number;

  @Column({ type: "varchar", length: 64 })
  contentHash!: string;

  @Column({ type: "varchar", length: 500 })
  storageKey!: string;

  @Column({ type: "varchar", length: 500 })
  storageUrl!: string;

  // Processing
  @Column({ type: "varchar", length: 20, default: "pending" })
  status!: string;

  @Column({ type: "int", default: 0 })
  totalPages!: number;

  @Column({ type: "int", default: 0 })
  processedPages!: number;

  // AI analysis
  @Column({ type: "varchar", length: 255, nullable: true })
  detectedTopic!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  detectedLanguage!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  detectedCefrLevel!: string | null;

  @Column({ type: "text", nullable: true })
  summary!: string | null;

  @Column({ type: "jsonb", default: [] })
  tags!: string[];

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  // Video future
  @Column({ type: "varchar", length: 255, nullable: true })
  videoStreamId!: string | null;

  @Column({ type: "float", nullable: true })
  videoDuration!: number | null;

  // Cached
  @Column({ type: "int", default: 0 })
  similarExerciseCount!: number;

  // Relations
  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => User)
  @JoinColumn({ name: "uploadedByUserId" })
  uploadedBy!: User;

  @OneToMany(() => MediaPage, (p) => p.mediaItem)
  pages!: MediaPage[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── MediaPage ──────────────────────────────────────

@Entity("media_pages")
@Unique(["mediaItemId", "pageNumber"])
export class MediaPage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  mediaItemId!: string;

  @Column({ type: "int" })
  pageNumber!: number;

  @Column({ type: "text" })
  extractedText!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  // Relations
  @ManyToOne(() => MediaItem, (m) => m.pages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mediaItemId" })
  mediaItem!: MediaItem;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Notification ──────────────────────────────────

@Entity("notifications")
@Index(["userId"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 50 })
  type!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "jsonb", nullable: true })
  data!: Record<string, string> | null;

  @Column({ type: "boolean", default: false })
  read!: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
