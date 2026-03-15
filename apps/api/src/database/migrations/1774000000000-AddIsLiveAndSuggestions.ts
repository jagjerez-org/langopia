import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsLiveAndSuggestions1774000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transcriptions" ADD COLUMN "isLive" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "rooms" ADD COLUMN "suggestions" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rooms" DROP COLUMN "suggestions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transcriptions" DROP COLUMN "isLive"`,
    );
  }
}
