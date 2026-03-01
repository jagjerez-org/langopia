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
} from "typeorm";
import {
  AcademyPlan,
  UserRole,
  ClassroomType,
  SessionStatus,
  Speaker,
} from "@langopia/shared/types";

// ─── Academy ──────────────────────────────────────────────

@Entity("academies")
export class Academy {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  slug!: string;

  @Column({ type: "enum", enum: AcademyPlan, default: AcademyPlan.FREE })
  plan!: AcademyPlan;

  @Column({ type: "jsonb", default: {} })
  settings!: Record<string, unknown>;

  @Column({ type: "varchar", length: 100, default: "UTC" })
  timezone!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeSubscriptionId!: string | null;

  @OneToMany(() => User, (user) => user.academy)
  users!: User[];

  @OneToMany(() => Classroom, (classroom) => classroom.academy)
  classrooms!: Classroom[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

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

  @Column({ type: "enum", enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @Column({ type: "uuid", nullable: true })
  academyId!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @ManyToOne(() => Academy, (academy) => academy.users, { nullable: true })
  @JoinColumn({ name: "academyId" })
  academy!: Academy | null;

  @OneToMany(() => Classroom, (classroom) => classroom.teacher)
  classrooms!: Classroom[];

  @OneToMany(() => ClassroomEnrollment, (enrollment) => enrollment.student)
  enrollments!: ClassroomEnrollment[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── Classroom ────────────────────────────────────────────

@Entity("classrooms")
export class Classroom {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  teacherId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({
    type: "enum",
    enum: ClassroomType,
    default: ClassroomType.ONE_TO_ONE,
  })
  type!: ClassroomType;

  @Column({ type: "varchar", length: 100 })
  languageTarget!: string;

  @Column({ type: "int", default: 1 })
  maxStudents!: number;

  @ManyToOne(() => Academy, (academy) => academy.classrooms)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => User, (user) => user.classrooms)
  @JoinColumn({ name: "teacherId" })
  teacher!: User;

  @OneToMany(() => Session, (session) => session.classroom)
  sessions!: Session[];

  @OneToMany(() => ClassroomEnrollment, (enrollment) => enrollment.classroom)
  enrollments!: ClassroomEnrollment[];

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── ClassroomEnrollment ──────────────────────────────────

@Entity("classroom_enrollments")
@Unique(["classroomId", "studentId"])
export class ClassroomEnrollment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  classroomId!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.enrollments)
  @JoinColumn({ name: "classroomId" })
  classroom!: Classroom;

  @ManyToOne(() => User, (user) => user.enrollments)
  @JoinColumn({ name: "studentId" })
  student!: User;

  @CreateDateColumn({ type: "timestamptz" })
  enrolledAt!: Date;
}

// ─── Session ──────────────────────────────────────────────

@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  classroomId!: string;

  @Column({ type: "timestamptz" })
  scheduledAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  endedAt!: Date | null;

  @Column({
    type: "enum",
    enum: SessionStatus,
    default: SessionStatus.SCHEDULED,
  })
  status!: SessionStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  livekitRoomId!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  recordingUrl!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  egressId!: string | null;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => Classroom, (classroom) => classroom.sessions)
  @JoinColumn({ name: "classroomId" })
  classroom!: Classroom;

  @OneToMany(() => Transcription, (transcription) => transcription.session)
  transcriptions!: Transcription[];

  @OneToOne(() => ClassReport, (report) => report.session)
  classReport!: ClassReport | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── Transcription ────────────────────────────────────────

@Entity("transcriptions")
export class Transcription {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  sessionId!: string;

  @Column({ type: "enum", enum: Speaker })
  speaker!: Speaker;

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

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => Session, (session) => session.transcriptions)
  @JoinColumn({ name: "sessionId" })
  session!: Session;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}

// ─── ClassReport ──────────────────────────────────────────

@Entity("class_reports")
export class ClassReport {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid", unique: true })
  sessionId!: string;

  @Column({ type: "text" })
  summary!: string;

  @Column({ type: "jsonb", default: [] })
  vocabulary!: Record<string, unknown>[];

  @Column({ type: "jsonb", default: [] })
  grammarErrors!: Record<string, unknown>[];

  @Column({ type: "jsonb", default: {} })
  speakingMetrics!: Record<string, unknown>;

  @Column({ type: "jsonb", default: [] })
  suggestions!: string[];

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @OneToOne(() => Session, (session) => session.classReport)
  @JoinColumn({ name: "sessionId" })
  session!: Session;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── LearningProfile ─────────────────────────────────────

@Entity("learning_profiles")
export class LearningProfile {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid", unique: true })
  studentId!: string;

  @Column({ type: "jsonb", default: [] })
  vocabularyBank!: Record<string, unknown>[];

  @Column({ type: "jsonb", default: [] })
  grammarPatterns!: Record<string, unknown>[];

  @Column({ type: "varchar", length: 10, nullable: true })
  cefrLevelEstimate!: string | null;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => User)
  @JoinColumn({ name: "studentId" })
  student!: User;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}

// ─── ProgressReport ──────────────────────────────────────

@Entity("progress_reports")
export class ProgressReport {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "uuid" })
  classroomId!: string;

  @Column({ type: "date" })
  periodStart!: Date;

  @Column({ type: "date" })
  periodEnd!: Date;

  @Column({ type: "jsonb", default: {} })
  scores!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  teacherComments!: string | null;

  @ManyToOne(() => Academy)
  @JoinColumn({ name: "academyId" })
  academy!: Academy;

  @ManyToOne(() => User)
  @JoinColumn({ name: "studentId" })
  student!: User;

  @ManyToOne(() => Classroom)
  @JoinColumn({ name: "classroomId" })
  classroom!: Classroom;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
