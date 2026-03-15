import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import { LessonProgressStatus } from "@langopia/shared/types";
import type { Student } from "./student.entity.js";
import type { Course } from "./course.entity.js";

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

  @Column({ type: "varchar", length: 20, default: LessonProgressStatus.NOT_STARTED })
  status!: string;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @ManyToOne("Course")
  @JoinColumn({ name: "courseId" })
  course!: Relation<Course>;
}
