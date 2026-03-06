import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { User } from "./user.entity.js";
import type { Academy } from "./academy.entity.js";

@Entity("team_members")
@Unique(["userId", "academyId"])
export class TeamMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 50 })
  role!: string;

  @Column({ type: "jsonb", default: [] })
  permissions!: string[];

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @ManyToOne("User", "teamMemberships")
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;

  @ManyToOne("Academy", "teamMembers")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  joinedAt!: Date;
}
