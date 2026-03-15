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
import { TeacherApplicationStatus } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";

@Entity("teacher_applications")
export class TeacherApplication {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  fullName!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: "jsonb", default: [] })
  languages!: string[];

  @Column({ type: "text", nullable: true })
  experience!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  cvUrl!: string | null;

  @Column({ type: "jsonb", default: [] })
  attachments!: { name: string; url: string }[];

  @Column({ type: "jsonb", default: {} })
  customFields!: Record<string, unknown>;

  @Column({ type: "enum", enum: TeacherApplicationStatus, default: TeacherApplicationStatus.PENDING })
  status!: TeacherApplicationStatus;

  @Column({ type: "text", nullable: true })
  reviewNotes!: string | null;

  @Column({ type: "uuid", nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  reviewedAt!: Date | null;

  @ManyToOne("Academy", "teacherApplications")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
