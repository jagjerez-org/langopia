import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import { StudentSubscriptionStatus } from "@langopia/shared/types";
import type { Student } from "./student.entity.js";
import type { AcademyPlan } from "./academy-plan.entity.js";
import type { Academy } from "./academy.entity.js";

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

  @Column({ type: "enum", enum: StudentSubscriptionStatus, default: StudentSubscriptionStatus.ACTIVE })
  status!: StudentSubscriptionStatus;

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

  @ManyToOne("Student", "subscriptions")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @ManyToOne("AcademyPlan", "subscriptions")
  @JoinColumn({ name: "academyPlanId" })
  academyPlan!: Relation<AcademyPlan>;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
