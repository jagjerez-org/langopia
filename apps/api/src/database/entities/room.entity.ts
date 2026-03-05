import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
  Relation,
} from "typeorm";
import { RoomStatus } from "@langopia/shared/types";
import type { Academy } from "./academy.entity.js";
import type { Lesson } from "./lesson.entity.js";
import type { User } from "./user.entity.js";
import type { RoomParticipant } from "./room-participant.entity.js";
import type { ChatMessage } from "./chat-message.entity.js";
import type { RoomNotes } from "./room-notes.entity.js";
import type { Transcription } from "./transcription.entity.js";
import type { ClassReport } from "./class-report.entity.js";

@Entity("rooms")
export class Room {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  createdByUserId!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "varchar", length: 100, default: "en" })
  language!: string;

  @Column({ type: "int", default: 1 })
  maxStudents!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  teacherToken!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255, unique: true })
  studentToken!: string;

  @Column({ type: "jsonb", default: [] })
  slides!: string[];

  @Column({ type: "enum", enum: RoomStatus, default: RoomStatus.WAITING })
  status!: RoomStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  livekitRoomId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  endedAt!: Date | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  recordingUrl!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  egressId!: string | null;

  @Column({ type: "uuid", nullable: true })
  lessonId!: string | null;

  @Column({ type: "jsonb", nullable: true })
  whiteboardData!: Record<string, unknown> | null;

  @ManyToOne("Academy", "rooms")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @ManyToOne("Lesson", { nullable: true })
  @JoinColumn({ name: "lessonId" })
  lesson!: Relation<Lesson | null>;

  @ManyToOne("User")
  @JoinColumn({ name: "createdByUserId" })
  createdBy!: Relation<User>;

  @OneToMany("RoomParticipant", "room")
  participants!: Relation<RoomParticipant[]>;

  @OneToMany("ChatMessage", "room")
  chatMessages!: Relation<ChatMessage[]>;

  @OneToOne("RoomNotes", "room")
  notes!: Relation<RoomNotes | null>;

  @OneToMany("Transcription", "room")
  transcriptions!: Relation<Transcription[]>;

  @OneToOne("ClassReport", "room")
  report!: Relation<ClassReport | null>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
