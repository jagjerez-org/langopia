import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaChunksTable1773400000000 implements MigrationInterface {
  name = "AddMediaChunksTable1773400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "media_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mediaItemId" uuid NOT NULL,
        "chunkType" varchar(50) NOT NULL,
        "title" varchar(500),
        "content" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "startPage" int NOT NULL,
        "endPage" int NOT NULL,
        "orderIndex" int NOT NULL,
        "embedding" vector(1536),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_chunks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_media_chunks_mediaItemId_orderIndex" UNIQUE ("mediaItemId", "orderIndex"),
        CONSTRAINT "FK_media_chunks_mediaItemId" FOREIGN KEY ("mediaItemId")
          REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_media_chunks_mediaItemId" ON "media_chunks" ("mediaItemId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_media_chunks_chunkType" ON "media_chunks" ("chunkType")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "media_chunks"`);
  }
}
