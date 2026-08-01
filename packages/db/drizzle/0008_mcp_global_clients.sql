ALTER TABLE "mcp_clients" ALTER COLUMN "school_id" DROP NOT NULL;--> statement-breakpoint
DELETE FROM "survey_responses" sr
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY
          survey_id,
          respondent_membership_id,
          COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ORDER BY submitted_at DESC, id DESC
      ) AS rn
    FROM "survey_responses"
  ) ranked
  WHERE ranked.rn > 1
) duplicates
WHERE sr.id = duplicates.id;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "survey_responses_unique_period_uq"
  ON "survey_responses" (
    "survey_id",
    "respondent_membership_id",
    COALESCE("session_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );--> statement-breakpoint
