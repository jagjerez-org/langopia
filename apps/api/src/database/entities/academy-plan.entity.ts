import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Relation,
} from "typeorm";
import { AcademyPlanPeriodicity } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";
import type { StudentSubscription } from "./student-subscription.entity.js";

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

  @Column({ type: "enum", enum: AcademyPlanPeriodicity, default: AcademyPlanPeriodicity.MONTHLY })
  periodicity!: AcademyPlanPeriodicity;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripePriceId!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "jsonb", default: {} })
  limits!: {
    individualClassesPerPeriod?: number;
    groupClassesPerPeriod?: number;
    classCancellationsPerPeriod?: number;
    classBookingsPerPeriod?: number;
    limitPeriod?: "daily" | "weekly" | "monthly" | "annual";
    accessLearningPath?: boolean;
    accessAiChat?: boolean;
    accessGroupClasses?: boolean;
    accessIndividualClasses?: boolean;
  };

  @ManyToOne("Academy", "academyPlans")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @OneToMany("StudentSubscription", "academyPlan")
  subscriptions!: Relation<StudentSubscription[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
