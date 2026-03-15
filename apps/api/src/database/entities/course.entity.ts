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
import { CourseStatus } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";
import type { CourseLesson } from "./course-lesson.entity.js";
import type { LearningPathCourse } from "./learning-path-course.entity.js";

@Entity("courses")
export class Course {
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

  @Column({ type: "varchar", length: 20 })
  cefrLevel!: string;

  @Column({ type: "enum", enum: CourseStatus, default: CourseStatus.DRAFT })
  status!: CourseStatus;

  @Column({ type: "varchar", length: 500, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: "float", nullable: true })
  estimatedHours!: number | null;

  @ManyToOne("Academy", "courses")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @OneToMany("CourseLesson", "course")
  courseLessons!: Relation<CourseLesson[]>;

  @OneToMany("LearningPathCourse", "course")
  learningPathCourses!: Relation<LearningPathCourse[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
