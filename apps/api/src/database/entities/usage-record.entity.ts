import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import { UsageMetric } from "@langopia/shared/types";
import type { User } from "./user.entity.js";
import type { Academy } from "./academy.entity.js";

@Entity("usage_records")
@Unique(["userId", "academyId", "period", "metric"])
export class UsageRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 7 })
  period!: string; // "YYYY-MM"

  @Column({ type: "enum", enum: UsageMetric })
  metric!: UsageMetric;

  @Column({ type: "bigint", default: 0 })
  value!: number;

  @ManyToOne("User")
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;
}
