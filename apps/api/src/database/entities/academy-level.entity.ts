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
import type { Academy } from "./academy.entity.js";

@Entity("academy_levels")
@Unique(["academyId", "code"])
export class AcademyLevel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 20 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  label!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne("Academy", "levels")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
