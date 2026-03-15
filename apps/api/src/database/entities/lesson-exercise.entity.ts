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
import type { Lesson } from "./lesson.entity.js";
import type { Exercise } from "./exercise.entity.js";

@Entity("lesson_exercises")
@Unique(["lessonId", "exerciseId"])
export class LessonExercise {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "uuid" })
  exerciseId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne("Lesson", "lessonExercises", { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson>;

  @ManyToOne("Exercise", "lessonExercises", { onDelete: "CASCADE" })
  @JoinColumn({ name: "exerciseId" })
  exercise!: Relation<Exercise>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
