import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import type { Room } from "./room.entity.js";

@Entity("room_notes")
export class RoomNotes {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  roomId!: string;

  @Column({ type: "jsonb", default: [] })
  vocabulary!: { word: string; definition: string; example: string }[];

  @Column({ type: "jsonb", default: [] })
  corrections!: { error: string; correction: string; context: string }[];

  @Column({ type: "text", default: "" })
  homework!: string;

  @Column({ type: "text", default: "" })
  objectives!: string;

  @OneToOne("Room", "notes")
  @JoinColumn({ name: "roomId" })
  room!: Relation<Room>;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
