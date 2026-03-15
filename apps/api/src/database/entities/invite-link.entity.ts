import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import type { Academy } from "./academy.entity.js";

@Entity("invite_links")
export class InviteLink {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 100, unique: true })
  token!: string;

  @Column({ type: "varchar", length: 50 })
  targetRole!: string;

  @Column({ type: "int", default: 0 })
  usedCount!: number;

  @Column({ type: "int", nullable: true })
  maxUses!: number | null;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @ManyToOne("Academy", "inviteLinks")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
