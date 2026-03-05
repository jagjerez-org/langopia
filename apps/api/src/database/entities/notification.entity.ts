import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Relation,
} from "typeorm";
import type { User } from "./user.entity.js";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 50 })
  type!: string;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({ type: "jsonb", nullable: true })
  data!: Record<string, string> | null;

  @Column({ type: "boolean", default: false })
  read!: boolean;

  @ManyToOne("User")
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
