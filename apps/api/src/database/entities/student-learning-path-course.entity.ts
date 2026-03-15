import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { StudentLearningPath } from "./student-learning-path.entity.js";
import type { Course } from "./course.entity.js";

@Entity("student_learning_path_courses")
@Unique(["studentLearningPathId", "courseId"])
export class StudentLearningPathCourse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  studentLearningPathId!: string;

  @Column({ type: "uuid" })
  courseId!: string;

  @Column({ type: "int" })
  sortOrder!: number;

  @Column({ type: "timestamptz" })
  addedAt!: Date;

  @ManyToOne("StudentLearningPath", "courses", { onDelete: "CASCADE" })
  @JoinColumn({ name: "studentLearningPathId" })
  studentLearningPath!: Relation<StudentLearningPath>;

  @ManyToOne("Course", { onDelete: "CASCADE" })
  @JoinColumn({ name: "courseId" })
  course!: Relation<Course>;
}
