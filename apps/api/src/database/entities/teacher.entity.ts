import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { Academy } from "./academy.entity.js";
import type { User } from "./user.entity.js";

@Entity("teachers")
@Unique(["academyId", "email"])
export class Teacher {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "jsonb", default: [] })
  languages!: string[];

  @Column({ type: "int", default: 0 })
  totalClasses!: number;

  @Column({ type: "int", default: 0 })
  totalMinutes!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @ManyToOne("Academy", "teachers")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @ManyToOne("User", { nullable: true })
  @JoinColumn({ name: "userId" })
  user!: Relation<User | null>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
