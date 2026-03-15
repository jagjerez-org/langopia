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
import { ExerciseSource } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";
import type { LessonExercise } from "./lesson-exercise.entity.js";
import type { ReportExercise } from "./report-exercise.entity.js";

@Entity("exercises")
export class Exercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 100 })
  type!: string;

  @Column({ type: "varchar", length: 100 })
  targetSkill!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  topic!: string | null;

  @Column({ type: "varchar", length: 10, default: "en" })
  language!: string;

  @Column({ type: "text" })
  instruction!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", nullable: true })
  options!: string[] | null;

  @Column({ type: "text" })
  correctAnswer!: string;

  @Column({ type: "text" })
  explanation!: string;

  @Column({ type: "varchar", length: 10 })
  cefrLevel!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  title!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  audioUrl!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  videoUrl!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  @Column({ type: "vector", length: 1536, nullable: true })
  topicEmbedding!: string | null;

  @Column({ type: "enum", enum: ExerciseSource, default: ExerciseSource.AI_LIVE })
  source!: ExerciseSource;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @OneToMany("LessonExercise", "exercise")
  lessonExercises!: Relation<LessonExercise[]>;

  @OneToMany("ReportExercise", "exercise")
  reportExercises!: Relation<ReportExercise[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
