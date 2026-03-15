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

@Entity("application_custom_fields")
export class ApplicationCustomField {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  label!: string;

  @Column({ type: "varchar", length: 50, default: "text" })
  fieldType!: string;

  @Column({ type: "boolean", default: false })
  isRequired!: boolean;

  @Column({ type: "jsonb", nullable: true })
  options!: string[] | null;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @ManyToOne("Academy", "applicationCustomFields")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
