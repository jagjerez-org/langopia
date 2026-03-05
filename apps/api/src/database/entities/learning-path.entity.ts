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
import { LearningPathStatus } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";
import type { LearningPathLesson } from "./learning-path-lesson.entity.js";

@Entity("learning_paths")
export class LearningPath {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 10 })
  language!: string;

  @Column({ type: "varchar", length: 5 })
  cefrLevel!: string;

  @Column({ type: "enum", enum: LearningPathStatus, default: LearningPathStatus.DRAFT })
  status!: LearningPathStatus;

  @Column({ type: "varchar", length: 500, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "float", nullable: true })
  estimatedHours!: number | null;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @OneToMany("LearningPathLesson", "learningPath")
  learningPathLessons!: Relation<LearningPathLesson[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
