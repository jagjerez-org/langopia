import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { User } from "./user.entity.js";
import type { Academy } from "./academy.entity.js";

@Entity("onboarding_progress")
@Unique(["userId", "academyId", "step"])
export class OnboardingProgress {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 50 })
  step!: string;

  @Column({ type: "boolean", default: false })
  completed!: boolean;

  @ManyToOne("User")
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
