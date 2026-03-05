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
import type { LearningPath } from "./learning-path.entity.js";
import type { Lesson } from "./lesson.entity.js";

@Entity("learning_path_lessons")
@Unique(["learningPathId", "lessonId"])
export class LearningPathLesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  learningPathId!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne("LearningPath", "learningPathLessons", { onDelete: "CASCADE" })
  @JoinColumn({ name: "learningPathId" })
  learningPath!: Relation<LearningPath>;

  @ManyToOne("Lesson", "learningPathLessons", { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
