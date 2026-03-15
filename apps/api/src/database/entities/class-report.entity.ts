import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import { ReportStatus } from "@langopia/shared/types";
import type { Room } from "./room.entity.js";

@Entity("class_reports")
export class ClassReport {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  roomId!: string;

  @Column({ type: "enum", enum: ReportStatus, default: ReportStatus.PROCESSING })
  status!: ReportStatus;

  @Column({ type: "text", nullable: true })
  summary!: string | null;

  @Column({ type: "int", default: 0 })
  classDuration!: number;

  @Column({ type: "int", default: 0 })
  tokensUsed!: number;

  @Column({ type: "jsonb", nullable: true })
  teacher!: { name: string; speakingTime: number; speakingRatio: number } | null;

  @Column({ type: "jsonb", default: [] })
  studentReports!: {
    studentId: string;
    name: string;
    email: string;
    speakingTime: number;
    speakingRatio: number;
    fillerWords: number;
    vocabulary: { word: string; cefrLevel: string; context: string }[];
    grammarErrors: { text: string; correction: string; rule: string; explanation: string }[];
    exercises: Record<string, unknown>[];
    homeworkSuggestions: string[];
  }[];

  @OneToOne("Room", "report")
  @JoinColumn({ name: "roomId" })
  room!: Relation<Room>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
