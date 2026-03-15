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
import type { User } from "./user.entity.js";
import type { MediaPage } from "./media-page.entity.js";
import type { MediaChunk } from "./media-chunk.entity.js";

@Entity("media_items")
@Unique(["academyId", "contentHash"])
export class MediaItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  academyId!: string;

  @Column({ type: "uuid" })
  uploadedByUserId!: string;

  @Column({ type: "varchar", length: 500 })
  filename!: string;

  @Column({ type: "varchar", length: 100 })
  mimeType!: string;

  @Column({ type: "int" })
  fileSize!: number;

  @Column({ type: "varchar", length: 64 })
  contentHash!: string;

  @Column({ type: "varchar", length: 500 })
  storageKey!: string;

  @Column({ type: "varchar", length: 500 })
  storageUrl!: string;

  @Column({ type: "varchar", length: 20, default: "pending" })
  status!: string;

  @Column({ type: "int", default: 0 })
  totalPages!: number;

  @Column({ type: "int", default: 0 })
  processedPages!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  detectedTopic!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  detectedLanguage!: string | null;

  @Column({ type: "varchar", length: 10, nullable: true })
  detectedCefrLevel!: string | null;

  @Column({ type: "text", nullable: true })
  summary!: string | null;

  @Column({ type: "jsonb", default: [] })
  tags!: string[];

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  videoStreamId!: string | null;

  @Column({ type: "float", nullable: true })
  videoDuration!: number | null;

  @Column({ type: "int", default: 0 })
  similarExerciseCount!: number;

  @ManyToOne("Academy")
  @JoinColumn({ name: "academyId" })
  academy!: Relation<Academy>;

  @ManyToOne("User")
  @JoinColumn({ name: "uploadedByUserId" })
  uploadedBy!: Relation<User>;

  @OneToMany("MediaPage", "mediaItem")
  pages!: Relation<MediaPage[]>;

  @OneToMany("MediaChunk", "mediaItem")
  chunks!: Relation<MediaChunk[]>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
