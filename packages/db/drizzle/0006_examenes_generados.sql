ALTER TABLE "assessments" ADD COLUMN "source_content_unit_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "skill_distribution" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "sections" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "duration_minutes" smallint;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "mock_framework" text;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "ai_score" real;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "ai_feedback" text;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "ai_model" text;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "ai_cost_cents" integer DEFAULT 0 NOT NULL;