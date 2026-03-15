import { MigrationInterface, QueryRunner } from "typeorm";

export class AddModuleToCourseLesson1773800000000 implements MigrationInterface {
  name = "AddModuleToCourseLesson1773800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_lessons" ADD COLUMN "module_title" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lessons" ADD COLUMN "module_order" int NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_lessons" DROP COLUMN "module_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_lessons" DROP COLUMN "module_title"`,
    );
  }
}
