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

@Entity("chat_messages")
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  roomId!: string;

  @Column({ type: "varchar", length: 255 })
  senderName!: string;

  @Column({ type: "enum", enum: ParticipantRole })
  senderRole!: ParticipantRole;

  @Column({ type: "text" })
  message!: string;

  @ManyToOne("Room", "chatMessages")
  @JoinColumn({ name: "roomId" })
  room!: Relation<Room>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
