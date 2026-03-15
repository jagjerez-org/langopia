import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Relation,
} from "typeorm";
import type { AcademyMember } from "./academy-member.entity.js";
import type { Student } from "./student.entity.js";
import type { Teacher } from "./teacher.entity.js";
import type { Room } from "./room.entity.js";
import type { Class } from "./class.entity.js";
import type { AcademyLevel } from "./academy-level.entity.js";
import type { AcademyLanguage } from "./academy-language.entity.js";
import type { Course } from "./course.entity.js";
import type { AcademyPlan } from "./academy-plan.entity.js";
import type { TeamMember } from "./team-member.entity.js";
import type { TeacherApplication } from "./teacher-application.entity.js";
import type { ApplicationCustomField } from "./application-custom-field.entity.js";
import type { InviteLink } from "./invite-link.entity.js";
import type { AcademyLanding } from "./academy-landing.entity.js";

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

  @Column({ type: "varchar", length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  stripeConnectAccountId!: string | null;

  @Column({ type: "boolean", default: false })
  onboardingCompleted!: boolean;

  @Column({ type: "jsonb", default: {} })
  settings!: Record<string, unknown>;

  @OneToMany("AcademyMember", "academy")
  members!: Relation<AcademyMember[]>;

  @OneToMany("Student", "academy")
  students!: Relation<Student[]>;

  @OneToMany("Teacher", "academy")
  teachers!: Relation<Teacher[]>;

  @OneToMany("Room", "academy")
  rooms!: Relation<Room[]>;

  @OneToMany("Class", "academy")
  classes!: Relation<Class[]>;

  @OneToMany("AcademyLevel", "academy")
  levels!: Relation<AcademyLevel[]>;

  @OneToMany("AcademyLanguage", "academy")
  languages!: Relation<AcademyLanguage[]>;

  @OneToMany("Course", "academy")
  courses!: Relation<Course[]>;

  @OneToMany("AcademyPlan", "academy")
  academyPlans!: Relation<AcademyPlan[]>;

  @OneToMany("TeamMember", "academy")
  teamMembers!: Relation<TeamMember[]>;

  @OneToMany("TeacherApplication", "academy")
  teacherApplications!: Relation<TeacherApplication[]>;

  @OneToMany("ApplicationCustomField", "academy")
  applicationCustomFields!: Relation<ApplicationCustomField[]>;

  @OneToMany("InviteLink", "academy")
  inviteLinks!: Relation<InviteLink[]>;

  @OneToOne("AcademyLanding", "academy")
  landing!: Relation<AcademyLanding>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
