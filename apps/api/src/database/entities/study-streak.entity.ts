import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { Student } from "./student.entity.js";

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

  @OneToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;
}
