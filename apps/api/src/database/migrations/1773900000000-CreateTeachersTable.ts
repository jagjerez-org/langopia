import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTeachersTable1773900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teachers table
    await queryRunner.query(`
      CREATE TABLE "teachers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "academyId" uuid NOT NULL,
        "email" varchar(255) NOT NULL,
        "name" varchar(255) NOT NULL,
        "languages" jsonb NOT NULL DEFAULT '[]',
        "totalClasses" int NOT NULL DEFAULT 0,
        "totalMinutes" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "userId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teachers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_teachers_academy_email" UNIQUE ("academyId", "email"),
        CONSTRAINT "FK_teachers_academy" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_teachers_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Migrate existing teacher data from academy_members to teachers
    // For each AcademyMember with "teacher" role, create a Teacher record
    await queryRunner.query(`
      INSERT INTO "teachers" ("id", "academyId", "email", "name", "userId", "createdAt", "updatedAt")
      SELECT
        am."id",
        am."academyId",
        u."email",
        u."name",
        u."id",
        am."joinedAt",
        am."joinedAt"
      FROM "academy_members" am
      INNER JOIN "users" u ON u."id" = am."userId"
      WHERE am."roles" @> '["teacher"]'
      ON CONFLICT ("academyId", "email") DO NOTHING
    `);

    // Drop old FK from classes.teacherId -> academy_members, add new FK -> teachers
    await queryRunner.query(`
      ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "FK_classes_teacher"
    `);

    // Also try the auto-generated constraint name
    await queryRunner.query(`
      DO $$
      DECLARE
        fk_name text;
      BEGIN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'classes'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'teacherId';
        IF fk_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "classes" DROP CONSTRAINT "' || fk_name || '"';
        END IF;
      END
      $$;
    `);

    // Add new FK from classes.teacherId -> teachers
    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD CONSTRAINT "FK_classes_teacher" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore FK to academy_members
    await queryRunner.query(`
      ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "FK_classes_teacher"
    `);

    await queryRunner.query(`
      ALTER TABLE "classes"
      ADD CONSTRAINT "FK_classes_teacher" FOREIGN KEY ("teacherId") REFERENCES "academy_members"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "teachers"`);
  }
}
