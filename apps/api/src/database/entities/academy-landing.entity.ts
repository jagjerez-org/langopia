import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import type { Academy } from "./academy.entity.js";

@Entity("academy_landings")
export class AcademyLanding {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", unique: true })
  academyId!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ type: "varchar", length: 7, default: "#6366f1" })
  primaryColor!: string;

  @Column({ type: "varchar", length: 7, default: "#f8fafc" })
  backgroundColor!: string;

  @Column({ type: "text", nullable: true })
  heroTitle!: string | null;

  @Column({ type: "text", nullable: true })
  heroDescription!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  heroImageUrl!: string | null;

  @Column({ type: "boolean", default: true })
  showPlans!: boolean;

  @Column({ type: "boolean", default: true })
  showTeacherApplication!: boolean;

  @Column({ type: "boolean", default: false })
  isPublished!: boolean;

  @OneToOne("Academy", "landing")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
