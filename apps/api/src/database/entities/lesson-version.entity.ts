import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  Relation,
} from "typeorm";
import type { Lesson } from "./lesson.entity.js";

@Entity("lesson_versions")
@Unique(["lessonId", "version"])
@Index(["lessonId"])
export class LessonVersion {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  lessonId!: string;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 10 })
  language!: string;

  @Column({ type: "varchar", length: 10 })
  cefrLevel!: string;

  @Column({ type: "varchar", length: 20 })
  status!: string;

  @Column({ type: "jsonb", default: [] })
  exerciseSnapshot!: Record<string, unknown>[];

  @ManyToOne("Lesson", { onDelete: "CASCADE" })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
