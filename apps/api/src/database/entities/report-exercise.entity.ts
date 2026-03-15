import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import type { ClassReport } from "./class-report.entity.js";
import type { Student } from "./student.entity.js";
import type { Exercise } from "./exercise.entity.js";

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

  @ManyToOne("ClassReport", { onDelete: "CASCADE" })
  @JoinColumn({ name: "reportId" })
  report!: Relation<ClassReport>;

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @ManyToOne("Exercise", "reportExercises", { onDelete: "CASCADE" })
  @JoinColumn({ name: "exerciseId" })
  exercise!: Relation<Exercise>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
