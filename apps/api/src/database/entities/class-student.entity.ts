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
import type { Class } from "./class.entity.js";
import type { Student } from "./student.entity.js";

@Entity("class_students")
@Unique(["classId", "studentId"])
export class ClassStudent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  classId!: string;

  @Column({ type: "uuid" })
  studentId!: string;

  @Column({ type: "varchar", length: 20, default: "enrolled" })
  status!: string;

  @ManyToOne("Class", "classStudents", { onDelete: "CASCADE" })
  @JoinColumn({ name: "classId" })
  class_!: Relation<Class>;

  @ManyToOne("Student")
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
