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

@Entity("academy_members")
@Unique(["userId", "academyId"])
export class AcademyMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "jsonb", default: ["teacher"] })
  roles!: string[];

  @ManyToOne("User", "academyMemberships")
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;

  @ManyToOne("Academy", "members")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  joinedAt!: Date;
}
