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

@Entity("academy_languages")
@Unique(["academyId", "code"])
export class AcademyLanguage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 10 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne("Academy", "languages")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
