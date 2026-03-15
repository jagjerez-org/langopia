import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { Student } from "./student.entity.js";

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

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;
}
