import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLessonVersionsTable1773600000000 implements MigrationInterface {
  name = "AddLessonVersionsTable1773600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lesson_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lessonId" uuid NOT NULL,
        "version" int NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "language" varchar(10) NOT NULL,
        "cefrLevel" varchar(10) NOT NULL,
        "status" varchar(20) NOT NULL,
        "exerciseSnapshot" jsonb NOT NULL DEFAULT '[]',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_versions_lessonId_version" UNIQUE ("lessonId", "version"),
        CONSTRAINT "FK_lesson_versions_lessonId" FOREIGN KEY ("lessonId")
          REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_lesson_versions_lessonId" ON "lesson_versions" ("lessonId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "lesson_versions"`);
  }
}
