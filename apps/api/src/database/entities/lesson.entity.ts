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
import { LessonStatus } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";
import type { LessonExercise } from "./lesson-exercise.entity.js";
import type { LearningPathLesson } from "./learning-path-lesson.entity.js";
import type { CourseLesson } from "./course-lesson.entity.js";

@Entity("lessons")
export class Lesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 10, default: "en" })
  language!: string;

  @Column({ type: "varchar", length: 10 })
  cefrLevel!: string;

  @Column({ type: "enum", enum: LessonStatus, default: LessonStatus.DRAFT })
  status!: LessonStatus;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @OneToMany("LessonExercise", "lesson")
  lessonExercises!: Relation<LessonExercise[]>;

  @OneToMany("LearningPathLesson", "lesson")
  learningPathLessons!: Relation<LearningPathLesson[]>;

  @OneToMany("CourseLesson", "lesson")
  courseLessons!: Relation<CourseLesson[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
