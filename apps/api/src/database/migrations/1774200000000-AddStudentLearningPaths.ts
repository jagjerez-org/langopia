import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStudentLearningPaths1774200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "student_learning_paths" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "academyId" uuid NOT NULL,
        "language" varchar(10) NOT NULL,
        "generatedAt" timestamptz NOT NULL DEFAULT now(),
        "lastAppendedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_learning_paths" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_student_learning_paths_studentId" UNIQUE ("studentId"),
        CONSTRAINT "FK_student_learning_paths_studentId" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_learning_paths_academyId" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "student_learning_path_courses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentLearningPathId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "sortOrder" int NOT NULL,
        "addedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_learning_path_courses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_slpc_path_course" UNIQUE ("studentLearningPathId", "courseId"),
        CONSTRAINT "FK_slpc_studentLearningPathId" FOREIGN KEY ("studentLearningPathId") REFERENCES "student_learning_paths"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_slpc_courseId" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_slpc_sortOrder" ON "student_learning_path_courses" ("studentLearningPathId", "sortOrder")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "student_learning_path_courses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_learning_paths"`);
  }
}
