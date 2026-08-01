ALTER TYPE "public"."actor_kind" ADD VALUE 'impersonation';--> statement-breakpoint
CREATE TABLE "impersonations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"target_membership_id" uuid NOT NULL,
	"impersonator_user_id" uuid NOT NULL,
	"impersonator_membership_id" uuid,
	"impersonator_name" text NOT NULL,
	"impersonator_email" text NOT NULL,
	"reason" text NOT NULL,
	"involves_minor" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_support_staff" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "impersonator_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "impersonations" ADD CONSTRAINT "impersonations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonations" ADD CONSTRAINT "impersonations_target_membership_id_memberships_id_fk" FOREIGN KEY ("target_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonations" ADD CONSTRAINT "impersonations_impersonator_user_id_users_id_fk" FOREIGN KEY ("impersonator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonations" ADD CONSTRAINT "impersonations_impersonator_membership_id_memberships_id_fk" FOREIGN KEY ("impersonator_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_support_staff" ADD CONSTRAINT "platform_support_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonations_school_ix" ON "impersonations" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "impersonations_target_ix" ON "impersonations" USING btree ("target_membership_id");--> statement-breakpoint
CREATE INDEX "impersonations_impersonator_ix" ON "impersonations" USING btree ("impersonator_user_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonator_membership_id_memberships_id_fk" FOREIGN KEY ("impersonator_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_impersonator_ix" ON "audit_logs" USING btree ("impersonator_membership_id");