import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Relation,
} from "typeorm";
import type { Academy } from "./academy.entity.js";
import type { Lesson } from "./lesson.entity.js";
import type { AcademyMember } from "./academy-member.entity.js";
import type { Room } from "./room.entity.js";
import type { User } from "./user.entity.js";
import type { ClassStudent } from "./class-student.entity.js";
import type { Course } from "./course.entity.js";

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

  @ManyToOne("Academy", "classes")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @ManyToOne("Lesson", { nullable: true })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson | null>;

  @ManyToOne("AcademyMember", { nullable: true })
  @JoinColumn({ name: "teacherId" })
  teacher!: Relation<AcademyMember | null>;

  @ManyToOne("Room", { nullable: true })
  @JoinColumn({ name: "roomId" })
  room!: Relation<Room | null>;

  @ManyToOne("Course", { nullable: true })
  @JoinColumn({ name: "courseId" })
  course!: Relation<Course | null>;

  @ManyToOne("User")
  @JoinColumn({ name: "createdByUserId" })
  createdBy!: Relation<User>;

  @OneToMany("ClassStudent", "class_")
  classStudents!: Relation<ClassStudent[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
