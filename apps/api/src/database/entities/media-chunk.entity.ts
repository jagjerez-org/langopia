import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  Relation,
} from "typeorm";
import type { MediaItem } from "./media-item.entity.js";

@Entity("media_chunks")
@Unique(["mediaItemId", "orderIndex"])
export class MediaChunk {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  mediaItemId!: string;

  @Column({ type: "varchar", length: 50 })
  chunkType!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  title!: string | null;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: "int" })
  startPage!: number;

  @Column({ type: "int" })
  endPage!: number;

  @Column({ type: "int" })
  orderIndex!: number;

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  @Index()
  @ManyToOne("MediaItem", "chunks", { onDelete: "CASCADE" })
  @JoinColumn({ name: "mediaItemId" })
  mediaItem!: Relation<MediaItem>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
