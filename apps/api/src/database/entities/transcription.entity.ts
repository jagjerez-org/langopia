import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import { ParticipantRole } from "@langopia/shared/types";
import type { Room } from "./room.entity.js";

@Entity("transcriptions")
export class Transcription {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  roomId!: string;

  @Column({ type: "varchar", length: 255 })
  speakerName!: string;

  @Column({ type: "enum", enum: ParticipantRole })
  speakerRole!: ParticipantRole;

  @Column({ type: "text" })
  text!: string;

  @Column({ type: "float" })
  timestampStart!: number;

  @Column({ type: "float" })
  timestampEnd!: number;

  @Column({ type: "jsonb", default: [] })
  wordTimestamps!: Record<string, unknown>[];

  @Column({ type: "varchar", length: 10, nullable: true })
  languageDetected!: string | null;

  @Column({ type: "boolean", default: false })
  isLive!: boolean;

  @ManyToOne("Room", "transcriptions")
  @JoinColumn({ name: "roomId" })
  room!: Relation<Room>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
