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
import type { Student } from "./student.entity.js";
import type { User } from "./user.entity.js";

@Entity("room_participants")
export class RoomParticipant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  roomId!: string;

  @Column({ type: "uuid", nullable: true })
  studentId!: string | null;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "enum", enum: ParticipantRole })
  role!: ParticipantRole;

  @Column({ type: "int", default: 0 })
  speakingTimeSeconds!: number;

  @Column({ type: "timestamptz", nullable: true })
  leftAt!: Date | null;

  @ManyToOne("Room", "participants")
  @JoinColumn({ name: "roomId" })
  room!: Relation<Room>;

  @ManyToOne("Student", "participations", { nullable: true })
  @JoinColumn({ name: "studentId" })
  student!: Relation<Student | null>;

  @ManyToOne("User", { nullable: true })
  @JoinColumn({ name: "userId" })
  user!: Relation<User | null>;

  @CreateDateColumn({ type: "timestamptz" })
  joinedAt!: Date;
}
