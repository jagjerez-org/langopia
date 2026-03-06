import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1772694189058 implements MigrationInterface {
    name = 'Migration1772694189058'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_userId"`);
        await queryRunner.query(`DROP INDEX "public"."idx_exercises_embedding_hnsw"`);
        await queryRunner.query(`DROP INDEX "public"."idx_exercises_topic_embedding_hnsw"`);
        await queryRunner.query(`DROP INDEX "public"."idx_media_items_embedding_hnsw"`);
        await queryRunner.query(`DROP INDEX "public"."idx_media_pages_embedding_hnsw"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_userId_read"`);
        await queryRunner.query(`CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"`);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_userId_read" ON "notifications" ("userId", "read") `);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId") `);
        await queryRunner.query(`CREATE INDEX "idx_media_pages_embedding_hnsw" ON "media_pages" ("embedding") `);
        await queryRunner.query(`CREATE INDEX "idx_media_items_embedding_hnsw" ON "media_items" ("embedding") `);
        await queryRunner.query(`CREATE INDEX "idx_exercises_topic_embedding_hnsw" ON "exercises" ("topicEmbedding") `);
        await queryRunner.query(`CREATE INDEX "idx_exercises_embedding_hnsw" ON "exercises" ("embedding") `);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
