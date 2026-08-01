ALTER TABLE "srs_cards" ALTER COLUMN "exercise_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'exercise';--> statement-breakpoint
ALTER TABLE "srs_cards" ADD COLUMN IF NOT EXISTS "source_transcript_id" uuid;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD COLUMN IF NOT EXISTS "term" text;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD COLUMN IF NOT EXISTS "definition" text;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD COLUMN IF NOT EXISTS "level" "cefr_level";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "srs_cards_student_transcript_term_uq"
  ON "srs_cards" ("student_profile_id", "source_transcript_id", lower("term"));--> statement-breakpoint
