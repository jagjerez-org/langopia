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
import type { Course } from "./course.entity.js";
import type { Lesson } from "./lesson.entity.js";

@Entity("course_lessons")
@Unique(["courseId", "lessonId"])
export class CourseLesson {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  moduleTitle!: string | null;

  @Column({ type: "int", default: 0 })
  moduleOrder!: number;

  @ManyToOne("Course", "courseLessons", { onDelete: "CASCADE" })
  @JoinColumn({ name: "courseId" })
  course!: Relation<Course>;

  @ManyToOne("Lesson", "courseLessons", { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
