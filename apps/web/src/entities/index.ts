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
  UserType,
  StudentProgressSource,
  LessonProgressStatus,
  ReviewItemType,
  ReviewSourceType,
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

  @Column({ type: "varchar", length: 20, default: "staff" })
  userType!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: "jsonb", default: [] })
  fcmTokens!: { token: string; platform: string; createdAt: string }[];

  @OneToMany(() => AcademyMember, (m) => m.user)
  academyMemberships!: AcademyMember[];

  @OneToMany(() => TeamMember, (tm) => tm.user)
  teamMemberships!: TeamMember[];

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

  @Column({ type: "varchar", length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeConnectAccountId!: string | null;

  @Column({ type: "boolean", default: false })
  onboardingCompleted!: boolean;

  @OneToMany(() => AcademyMember, (m) => m.academy)
  members!: AcademyMember[];

  @OneToMany(() => Student, (s) => s.academy)
  students!: Student[];

  @OneToMany(() => Teacher, (t) => t.academy)
  teachers!: Teacher[];

  @OneToMany(() => Room, (r) => r.academy)
  rooms!: Room[];

  @OneToMany(() => Class, (c) => c.academy)
  classes!: Class[];

  @OneToMany(() => AcademyLevel, (l) => l.academy)
  levels!: AcademyLevel[];

  @OneToMany(() => AcademyLanguage, (l) => l.academy)
  languages!: AcademyLanguage[];

  @OneToMany(() => Course, (c) => c.academy)
  courses!: Course[];

  @OneToMany(() => AcademyPlan, (p) => p.academy)
  academyPlans!: AcademyPlan[];

  @OneToMany(() => TeamMember, (tm) => tm.academy)
  teamMembers!: TeamMember[];

  @OneToMany(() => TeacherApplication, (ta) => ta.academy)
  teacherApplications!: TeacherApplication[];

  @OneToMany(() => ApplicationCustomField, (f) => f.academy)
  applicationCustomFields!: ApplicationCustomField[];

  @OneToMany(() => InviteLink, (il) => il.academy)
  inviteLinks!: InviteLink[];

  @OneToOne(() => AcademyLanding, (l) => l.academy)
  landing!: AcademyLanding | null;

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

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  nativeLanguage!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  learningLanguage!: string | null;

  @Column({ type: "varchar", length: 5, nullable: true })
  selfAssessedLevel!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  learningGoal!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  occupation!: string | null;

  @Column({ type: "jsonb", default: [] })
  interests!: string[];

  @Column({ type: "int", default: 15 })
  dailyGoalMinutes!: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  timezone!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: "boolean", default: false })
  onboardingCompleted!: boolean;

  @ManyToOne(() => Academy, (a) => a.students)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => RoomParticipant, (p) => p.student)
  participations!: RoomParticipant[];

  @OneToMany(() => StudentSubscription, (ss) => ss.student)
  subscriptions!: StudentSubscription[];

  @CreateDateColumn({ type: "timestamptz" })
  firstSeenAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  lastSeenAt!: Date;
}

// ─── Teacher ─────────────────────────────────────────

@Entity("teachers")
@Unique(["academyId", "email"])
export class Teacher {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "jsonb", default: [] })
  languages!: string[];

  @Column({ type: "int", default: 0 })
  totalClasses!: number;

  @Column({ type: "int", default: 0 })
  totalMinutes!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @ManyToOne(() => Academy, (a) => a.teachers)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user!: User | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
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

  @OneToMany(() => CourseLesson, (cl) => cl.lesson)
  courseLessons!: CourseLesson[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── LessonVersion ───────────────────────────────────────

@Entity("lesson_versions")
@Unique(["lessonId", "version"])
@Index(["lessonId"])
export class LessonVersion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 10 })
  language!: string;

  @Column({ type: "varchar", length: 10 })
  cefrLevel!: string;

  @Column({ type: "varchar", length: 20 })
  status!: string;

  @Column({ type: "jsonb", default: [] })
  exerciseSnapshot!: Record<string, unknown>[];

  @ManyToOne(() => Lesson, { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
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

  @OneToMany(() => LearningPathCourse, (lpc) => lpc.learningPath)
  learningPathCourses!: LearningPathCourse[];

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

  @Column({ type: "uuid", nullable: true })
  courseId!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  zoomLink!: string | null;

  @ManyToOne(() => Academy, (a) => a.classes)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson | null;

  @ManyToOne(() => Course, { nullable: true })
  @JoinColumn({ name: "courseId" })
  course!: Course | null;

  @ManyToOne(() => Teacher, { nullable: true })
  @JoinColumn({ name: "teacherId" })
  teacher!: Teacher | null;

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

  @Column({ type: "jsonb", nullable: true })
  suggestions!: Record<string, unknown>[] | null;

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

  @Column({ type: "boolean", default: false })
  isLive!: boolean;

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

  @OneToMany(() => MediaChunk, (c) => c.mediaItem)
  chunks!: MediaChunk[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── MediaChunk ──────────────────────────────────────

@Entity("media_chunks")
@Unique(["mediaItemId", "orderIndex"])
export class MediaChunk {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  mediaItemId!: string;

  @Column({ type: "varchar", length: 50 })
  chunkType!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  title!: string | null;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: "int" })
  startPage!: number;

  @Column({ type: "int" })
  endPage!: number;

  @Column({ type: "int" })
  orderIndex!: number;

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  @ManyToOne(() => MediaItem, (m) => m.chunks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "mediaItemId" })
  mediaItem!: MediaItem;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
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

// ─── AcademyLevel ─────────────────────────────────────────

@Entity("academy_levels")
@Unique(["academyId", "code"])
export class AcademyLevel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 20 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  label!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne(() => Academy, (a) => a.levels)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── AcademyLanguage ──────────────────────────────────────

@Entity("academy_languages")
@Unique(["academyId", "code"])
export class AcademyLanguage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 10 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne(() => Academy, (a) => a.languages)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Course ───────────────────────────────────────────────

@Entity("courses")
export class Course {
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

  @Column({ type: "varchar", length: 20 })
  cefrLevel!: string;

  @Column({ type: "varchar", length: 20, default: "draft" })
  status!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "float", nullable: true })
  estimatedHours!: number | null;

  @ManyToOne(() => Academy, (a) => a.courses)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => CourseLesson, (cl) => cl.course)
  courseLessons!: CourseLesson[];

  @OneToMany(() => LearningPathCourse, (lpc) => lpc.course)
  learningPathCourses!: LearningPathCourse[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── CourseLesson (Course ↔ Lesson join) ──────────────────

@Entity("course_lessons")
@Unique(["courseId", "lessonId"])
export class CourseLesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  moduleTitle!: string | null;

  @Column({ type: "int", default: 0 })
  moduleOrder!: number;

  @ManyToOne(() => Course, (c) => c.courseLessons, { onDelete: "CASCADE" })
  @JoinColumn({ name: "courseId" })
  course!: Course;

  @ManyToOne(() => Lesson, (l) => l.courseLessons, { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Lesson;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── LearningPathCourse (LearningPath ↔ Course join) ─────

@Entity("learning_path_courses")
@Unique(["learningPathId", "courseId"])
export class LearningPathCourse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  learningPathId!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne(() => LearningPath, (lp) => lp.learningPathCourses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "learningPathId" })
  learningPath!: LearningPath;

  @ManyToOne(() => Course, (c) => c.learningPathCourses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "courseId" })
  course!: Course;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── AcademyPlan ──────────────────────────────────────────

@Entity("academy_plans")
export class AcademyPlan {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ type: "varchar", length: 3, default: "EUR" })
  currency!: string;

  @Column({ type: "varchar", length: 20, default: "monthly" })
  periodicity!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripePriceId!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "jsonb", default: {} })
  limits!: Record<string, unknown>;

  @ManyToOne(() => Academy, (a) => a.academyPlans)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToMany(() => StudentSubscription, (ss) => ss.academyPlan)
  studentSubscriptions!: StudentSubscription[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── StudentSubscription ──────────────────────────────────

@Entity("student_subscriptions")
export class StudentSubscription {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "uuid" })
  academyPlanId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 20, default: "active" })
  status!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeSubscriptionId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  currentPeriodStart!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  cancelledAt!: Date | null;

  @ManyToOne(() => Student, (s) => s.subscriptions)
  @JoinColumn({ name: "studentId" })
  student!: Student;

  @ManyToOne(() => AcademyPlan, (ap) => ap.studentSubscriptions)
  @JoinColumn({ name: "academyPlanId" })
  academyPlan!: AcademyPlan;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── TeacherApplication ───────────────────────────────────

@Entity("teacher_applications")
export class TeacherApplication {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  fullName!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: "jsonb", default: [] })
  languages!: string[];

  @Column({ type: "text", nullable: true })
  experience!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  cvUrl!: string | null;

  @Column({ type: "jsonb", default: [] })
  attachments!: string[];

  @Column({ type: "jsonb", default: {} })
  customFields!: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status!: string;

  @Column({ type: "text", nullable: true })
  reviewNotes!: string | null;

  @Column({ type: "uuid", nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @ManyToOne(() => Academy, (a) => a.teacherApplications)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── ApplicationCustomField ──────────────────────────────

@Entity("application_custom_fields")
export class ApplicationCustomField {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  label!: string;

  @Column({ type: "varchar", length: 50, default: "text" })
  fieldType!: string;

  @Column({ type: "boolean", default: false })
  isRequired!: boolean;

  @Column({ type: "jsonb", nullable: true })
  options!: string[] | null;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne(() => Academy, (a) => a.applicationCustomFields)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── TeamMember ───────────────────────────────────────────

@Entity("team_members")
@Unique(["userId", "academyId"])
export class TeamMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 50 })
  role!: string;

  @Column({ type: "jsonb", default: [] })
  permissions!: string[];

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @ManyToOne(() => User, (u) => u.teamMemberships)
  @JoinColumn({ name: "userId" })
  user!: User;

  @ManyToOne(() => Academy, (a) => a.teamMembers)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @Column({ type: "timestamptz" })
  joinedAt!: Date;
}

// ─── OnboardingProgress ──────────────────────────────────

@Entity("onboarding_progress")
@Unique(["userId", "academyId", "step"])
export class OnboardingProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 50 })
  step!: string;

  @Column({ type: "boolean", default: false })
  completed!: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── AcademyLanding ──────────────────────────────────────

@Entity("academy_landings")
export class AcademyLanding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  academyId!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ type: "varchar", length: 7, default: "#6366f1" })
  primaryColor!: string;

  @Column({ type: "varchar", length: 7, default: "#f8fafc" })
  backgroundColor!: string;

  @Column({ type: "text", nullable: true })
  heroTitle!: string | null;

  @Column({ type: "text", nullable: true })
  heroDescription!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  heroImageUrl!: string | null;

  @Column({ type: "boolean", default: true })
  showPlans!: boolean;

  @Column({ type: "boolean", default: true })
  showTeacherApplication!: boolean;

  @Column({ type: "boolean", default: false })
  isPublished!: boolean;

  @OneToOne(() => Academy, (a) => a.landing)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── InviteLink ──────────────────────────────────────────

@Entity("invite_links")
export class InviteLink {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 100, unique: true })
  token!: string;

  @Column({ type: "varchar", length: 50 })
  targetRole!: string;

  @Column({ type: "int", default: 0 })
  usedCount!: number;

  @Column({ type: "int", nullable: true })
  maxUses!: number | null;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @ManyToOne(() => Academy, (a) => a.inviteLinks)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Student Progress ──────────────────────────────────

@Entity("student_progress")
export class StudentProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "uuid" })
  exerciseId!: string;

  @Column({ type: "uuid", nullable: true })
  lessonId!: string | null;

  @Column({ type: "boolean", default: false })
  isCompleted!: boolean;

  @Column({ type: "boolean", nullable: true })
  isCorrect!: boolean | null;

  @Column({ type: "text", nullable: true })
  studentAnswer!: string | null;

  @Column({ type: "int", default: 0 })
  timeSpentSeconds!: number;

  @Column({ type: "int", default: 1 })
  attemptNumber!: number;

  @Column({ type: "varchar", length: 20, default: "lesson" })
  source!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── Lesson Progress ───────────────────────────────────

@Entity("lesson_progress")
@Unique(["studentId", "lessonId"])
export class LessonProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int", default: 0 })
  completedExercises!: number;

  @Column({ type: "int", default: 0 })
  totalExercises!: number;

  @Column({ type: "int", default: 0 })
  lastExerciseIndex!: number;

  @Column({ type: "varchar", length: 20, default: "not_started" })
  status!: string;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;
}

// ─── Course Progress ───────────────────────────────────

@Entity("course_progress")
@Unique(["studentId", "courseId"])
export class CourseProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @Column({ type: "int", default: 0 })
  completedLessons!: number;

  @Column({ type: "int", default: 0 })
  totalLessons!: number;

  @Column({ type: "varchar", length: 20, default: "not_started" })
  status!: string;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;
}

// ─── Study Streak ──────────────────────────────────────

@Entity("study_streaks")
@Unique(["studentId"])
export class StudyStreak {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "int", default: 0 })
  currentStreak!: number;

  @Column({ type: "int", default: 0 })
  longestStreak!: number;

  @Column({ type: "date", nullable: true })
  lastActivityDate!: string | null;

  @Column({ type: "int", default: 1 })
  freezesAvailable!: number;

  @Column({ type: "int", default: 0 })
  totalActivityDays!: number;
}

// ─── Daily Activity ────────────────────────────────────

@Entity("daily_activities")
@Unique(["studentId", "activityDate"])
export class DailyActivity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "date" })
  activityDate!: string;

  @Column({ type: "int", default: 0 })
  exercisesCompleted!: number;

  @Column({ type: "int", default: 0 })
  reviewItemsCompleted!: number;

  @Column({ type: "int", default: 0 })
  minutesPracticed!: number;

  @Column({ type: "int", default: 0 })
  classesAttended!: number;

  @Column({ type: "int", default: 0 })
  xpEarned!: number;
}

// ─── Review Item ───────────────────────────────────────

@Entity("review_items")
export class ReviewItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "varchar", length: 20, default: "vocabulary" })
  itemType!: string;

  @Column({ type: "jsonb", default: {} })
  content!: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "class_report" })
  sourceType!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  sourceId!: string | null;

  @Column({ type: "float", default: 2.5 })
  easeFactor!: number;

  @Column({ type: "int", default: 1 })
  interval!: number;

  @Column({ type: "int", default: 0 })
  repetitions!: number;

  @Column({ type: "date" })
  nextReviewDate!: string;

  @Column({ type: "boolean", default: false })
  isRetired!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
