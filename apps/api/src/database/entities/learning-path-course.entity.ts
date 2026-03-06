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
import type { Course } from "./course.entity.js";

@Entity("learning_path_courses")
@Unique(["learningPathId", "courseId"])
export class LearningPathCourse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  learningPathId!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne("LearningPath", "learningPathCourses", { onDelete: "CASCADE" })
  @JoinColumn({ name: "learningPathId" })
  learningPath!: Relation<LearningPath>;

  @ManyToOne("Course", "learningPathCourses", { onDelete: "CASCADE" })
  @JoinColumn({ name: "courseId" })
  course!: Relation<Course>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
