import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Relation,
} from "typeorm";
import type { Academy } from "./academy.entity.js";
import type { RoomParticipant } from "./room-participant.entity.js";
import type { StudentSubscription } from "./student-subscription.entity.js";

@Entity("students")
@Unique(["academyId", "email"])
export class Student {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "int", default: 0 })
  totalRooms!: number;

  @Column({ type: "int", default: 0 })
  totalMinutes!: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  cefrEstimate!: string | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "uuid", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  nativeLanguage!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  learningLanguage!: string | null;

  @Column({ type: "varchar", length: 5, nullable: true })
  selfAssessedLevel!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  learningGoal!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  occupation!: string | null;

  @Column({ type: "jsonb", default: [] })
  interests!: string[];

  @Column({ type: "int", default: 15 })
  dailyGoalMinutes!: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  timezone!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  profileImageUrl!: string | null;

  @Column({ type: "boolean", default: false })
  onboardingCompleted!: boolean;

  @ManyToOne("Academy", "students")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @OneToMany("RoomParticipant", "student")
  participations!: Relation<RoomParticipant[]>;

  @OneToMany("StudentSubscription", "student")
  subscriptions!: Relation<StudentSubscription[]>;

  @CreateDateColumn({ type: "timestamptz" })
  firstSeenAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  lastSeenAt!: Date;
}
