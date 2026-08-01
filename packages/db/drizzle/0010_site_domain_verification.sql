ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "verification_token" text NOT NULL DEFAULT 'legacy-verified-domain';--> statement-breakpoint
ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "verification_expires_at" timestamp with time zone NOT NULL DEFAULT now() + interval '48 hours';--> statement-breakpoint
ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "verification_failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "verification_failure_reason" text;--> statement-breakpoint
ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "tls_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "school_domains"
  ADD COLUMN IF NOT EXISTS "tls_status" text NOT NULL DEFAULT 'pending';--> statement-breakpoint
UPDATE "school_domains"
SET "status" = CASE
    WHEN "verified_at" IS NOT NULL THEN 'verified'
    ELSE "status"
  END,
  "tls_status" = CASE
    WHEN "verified_at" IS NOT NULL THEN 'noop'
    ELSE "tls_status"
  END;--> statement-breakpoint
