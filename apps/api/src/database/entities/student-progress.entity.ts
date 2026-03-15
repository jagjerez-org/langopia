import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import { StudentProgressSource } from "@langopia/shared/types";
import type { Student } from "./student.entity.js";
import type { Exercise } from "./exercise.entity.js";
import type { Lesson } from "./lesson.entity.js";

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

  @Column({ type: "varchar", length: 20, default: StudentProgressSource.LESSON })
  source!: string;

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @ManyToOne("Exercise")
  @JoinColumn({ name: "exerciseId" })
  exercise!: Relation<Exercise>;

  @ManyToOne("Lesson", { nullable: true })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
