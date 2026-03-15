import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Relation,
} from "typeorm";
import type { Student } from "./student.entity.js";
import type { StudentLearningPathCourse } from "./student-learning-path-course.entity.js";

@Entity("student_learning_paths")
export class StudentLearningPath {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  studentId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 10 })
  language!: string;

  @Column({ type: "timestamptz" })
  generatedAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  lastAppendedAt!: Date | null;

  @OneToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @OneToMany("StudentLearningPathCourse", "studentLearningPath")
  courses!: Relation<StudentLearningPathCourse[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
