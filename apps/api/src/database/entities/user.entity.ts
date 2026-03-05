import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Relation,
} from "typeorm";
import { UserPlan } from "@langopia/shared/types";
import type { AcademyMember } from "./academy-member.entity.js";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: "enum", enum: UserPlan, default: UserPlan.FREE })
  plan!: UserPlan;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeCustomerId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeSubscriptionId!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: "jsonb", default: [] })
  fcmTokens!: { token: string; platform: string; createdAt: string }[];

  @OneToMany("AcademyMember", "user")
  academyMemberships!: Relation<AcademyMember[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
