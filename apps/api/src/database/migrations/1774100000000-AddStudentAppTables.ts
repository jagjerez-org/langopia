import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStudentAppTables1774100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add userType to users
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "userType" varchar(20) NOT NULL DEFAULT 'staff'
    `);

    // Add onboarding fields to students
    await queryRunner.query(`
      ALTER TABLE "students"
        ADD COLUMN IF NOT EXISTS "nativeLanguage" varchar(10),
        ADD COLUMN IF NOT EXISTS "learningLanguage" varchar(10),
        ADD COLUMN IF NOT EXISTS "selfAssessedLevel" varchar(5),
        ADD COLUMN IF NOT EXISTS "learningGoal" varchar(50),
        ADD COLUMN IF NOT EXISTS "occupation" varchar(50),
        ADD COLUMN IF NOT EXISTS "interests" jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "dailyGoalMinutes" int NOT NULL DEFAULT 15,
        ADD COLUMN IF NOT EXISTS "timezone" varchar(50),
        ADD COLUMN IF NOT EXISTS "profileImageUrl" varchar(500),
        ADD COLUMN IF NOT EXISTS "onboardingCompleted" boolean NOT NULL DEFAULT false
    `);

    // Student progress (exercise attempts)
    await queryRunner.query(`
      CREATE TABLE "student_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "exerciseId" uuid NOT NULL,
        "lessonId" uuid,
        "isCompleted" boolean NOT NULL DEFAULT false,
        "isCorrect" boolean,
        "studentAnswer" text,
        "timeSpentSeconds" int NOT NULL DEFAULT 0,
        "attemptNumber" int NOT NULL DEFAULT 1,
        "source" varchar(20) NOT NULL DEFAULT 'lesson',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_student_progress" PRIMARY KEY ("id"),
        CONSTRAINT "FK_student_progress_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_progress_exercise" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_progress_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL
      )
    `);

    // Lesson progress
    await queryRunner.query(`
      CREATE TABLE "lesson_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "lessonId" uuid NOT NULL,
        "completedExercises" int NOT NULL DEFAULT 0,
        "totalExercises" int NOT NULL DEFAULT 0,
        "lastExerciseIndex" int NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'not_started',
        "completedAt" timestamptz,
        CONSTRAINT "PK_lesson_progress" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lesson_progress_student_lesson" UNIQUE ("studentId", "lessonId"),
        CONSTRAINT "FK_lesson_progress_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_progress_lesson" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE
      )
    `);

    // Course progress
    await queryRunner.query(`
      CREATE TABLE "course_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "courseId" uuid NOT NULL,
        "completedLessons" int NOT NULL DEFAULT 0,
        "totalLessons" int NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'not_started',
        "completedAt" timestamptz,
        CONSTRAINT "PK_course_progress" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_course_progress_student_course" UNIQUE ("studentId", "courseId"),
        CONSTRAINT "FK_course_progress_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_progress_course" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);

    // Study streaks
    await queryRunner.query(`
      CREATE TABLE "study_streaks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "currentStreak" int NOT NULL DEFAULT 0,
        "longestStreak" int NOT NULL DEFAULT 0,
        "lastActivityDate" date,
        "freezesAvailable" int NOT NULL DEFAULT 1,
        "totalActivityDays" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_study_streaks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_study_streaks_student" UNIQUE ("studentId"),
        CONSTRAINT "FK_study_streaks_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
      )
    `);

    // Daily activities
    await queryRunner.query(`
      CREATE TABLE "daily_activities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "activityDate" date NOT NULL,
        "exercisesCompleted" int NOT NULL DEFAULT 0,
        "reviewItemsCompleted" int NOT NULL DEFAULT 0,
        "minutesPracticed" int NOT NULL DEFAULT 0,
        "classesAttended" int NOT NULL DEFAULT 0,
        "xpEarned" int NOT NULL DEFAULT 0,
        CONSTRAINT "PK_daily_activities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_daily_activities_student_date" UNIQUE ("studentId", "activityDate"),
        CONSTRAINT "FK_daily_activities_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
      )
    `);

    // Review items (spaced repetition)
    await queryRunner.query(`
      CREATE TABLE "review_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "studentId" uuid NOT NULL,
        "itemType" varchar(20) NOT NULL DEFAULT 'vocabulary',
        "content" jsonb NOT NULL DEFAULT '{}',
        "sourceType" varchar(20) NOT NULL DEFAULT 'class_report',
        "sourceId" varchar(255),
        "easeFactor" float NOT NULL DEFAULT 2.5,
        "interval" int NOT NULL DEFAULT 1,
        "repetitions" int NOT NULL DEFAULT 0,
        "nextReviewDate" date NOT NULL,
        "isRetired" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_review_items_student" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_student_progress_student" ON "student_progress" ("studentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_lesson_progress_student" ON "lesson_progress" ("studentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_course_progress_student" ON "course_progress" ("studentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_daily_activities_student_date" ON "daily_activities" ("studentId", "activityDate")`);
    await queryRunner.query(`CREATE INDEX "IDX_review_items_student_next" ON "review_items" ("studentId", "nextReviewDate") WHERE "isRetired" = false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "review_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_activities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "study_streaks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_progress"`);

    await queryRunner.query(`
      ALTER TABLE "students"
        DROP COLUMN IF EXISTS "nativeLanguage",
        DROP COLUMN IF EXISTS "learningLanguage",
        DROP COLUMN IF EXISTS "selfAssessedLevel",
        DROP COLUMN IF EXISTS "learningGoal",
        DROP COLUMN IF EXISTS "occupation",
        DROP COLUMN IF EXISTS "interests",
        DROP COLUMN IF EXISTS "dailyGoalMinutes",
        DROP COLUMN IF EXISTS "timezone",
        DROP COLUMN IF EXISTS "profileImageUrl",
        DROP COLUMN IF EXISTS "onboardingCompleted"
    `);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "userType"`);
  }
}
