import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Relation,
  CreateDateColumn,
} from "typeorm";
import { ReviewItemType, ReviewSourceType } from "@langopia/shared/types";
import type { Student } from "./student.entity.js";

@Entity("review_items")
export class ReviewItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "varchar", length: 20, default: ReviewItemType.VOCABULARY })
  itemType!: string;

  @Column({ type: "jsonb", default: {} })
  content!: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: ReviewSourceType.CLASS_REPORT })
  sourceType!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  sourceId!: string | null;

  @Column({ type: "float", default: 2.5 })
  easeFactor!: number;

  @Column({ type: "int", default: 1 })
  interval!: number;

  @Column({ type: "int", default: 0 })
  repetitions!: number;

  @Column({ type: "date" })
  nextReviewDate!: string;

  @Column({ type: "boolean", default: false })
  isRetired!: boolean;

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
