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
import type { MediaItem } from "./media-item.entity.js";

@Entity("media_pages")
@Unique(["mediaItemId", "pageNumber"])
export class MediaPage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  mediaItemId!: string;

  @Column({ type: "int" })
  pageNumber!: number;

  @Column({ type: "text" })
  extractedText!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ type: "vector", length: 1536, nullable: true })
  embedding!: string | null;

  @ManyToOne("MediaItem", "pages", { onDelete: "CASCADE" })
  @JoinColumn({ name: "mediaItemId" })
  mediaItem!: Relation<MediaItem>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
