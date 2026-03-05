import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Relation,
} from "typeorm";
import type { AcademyMember } from "./academy-member.entity.js";
import type { Student } from "./student.entity.js";
import type { Room } from "./room.entity.js";
import type { Class } from "./class.entity.js";

@Entity("academies")
export class Academy {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  slug!: string;

  @Column({ type: "varchar", length: 255, unique: true })
  apiKey!: string;

  @Column({ type: "varchar", length: 20, default: "academy" })
  academyType!: string;

  @Column({ type: "jsonb", default: {} })
  settings!: Record<string, unknown>;

  @OneToMany("AcademyMember", "academy")
  members!: Relation<AcademyMember[]>;

  @OneToMany("Student", "academy")
  students!: Relation<Student[]>;

  @OneToMany("Room", "academy")
  rooms!: Relation<Room[]>;

  @OneToMany("Class", "academy")
  classes!: Relation<Class[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
