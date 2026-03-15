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
import type { Lesson } from "./lesson.entity.js";

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

  @Column({ type: "varchar", length: 20, default: LessonProgressStatus.NOT_STARTED })
  status!: string;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @ManyToOne("Lesson")
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson>;
}
