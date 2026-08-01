CREATE TYPE "public"."actor_kind" AS ENUM('user', 'system', 'mcp', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."ai_generation_kind" AS ENUM('unit_outline', 'unit_body', 'exercise_set', 'exam', 'placement_test', 'written_correction', 'audio_tts', 'image', 'video_beta', 'session_summary');--> statement-breakpoint
CREATE TYPE "public"."ai_generation_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."assessment_kind" AS ENUM('placement', 'unit_exam', 'level_exam', 'mock_official');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('scheduled', 'in_progress', 'submitted', 'ai_graded', 'teacher_validated', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."asset_kind" AS ENUM('audio', 'image', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'ai_graded', 'teacher_validated', 'returned');--> statement-breakpoint
CREATE TYPE "public"."attendance_source" AS ENUM('auto', 'manual', 'imported');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'absent', 'excused');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."cefr_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM('data_processing', 'recording', 'transcription', 'ai_processing', 'marketing', 'image_rights');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('pending', 'granted', 'denied', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."content_source" AS ENUM('ai_generated', 'uploaded', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'in_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."course_modality" AS ENUM('private', 'group', 'intensive', 'exam_prep', 'business', 'conversation');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('plan_grant', 'topup', 'generation', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'withdrawn', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('cloze', 'multiple_choice', 'matching', 'ordering', 'minimal_pairs', 'dictation', 'shadowing', 'listening_comprehension', 'reading_comprehension', 'written_production', 'spoken_production');--> statement-breakpoint
CREATE TYPE "public"."group_status" AS ENUM('planned', 'running', 'finished', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."guardian_relationship" AS ENUM('mother', 'father', 'legal_guardian', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_direction" AS ENUM('platform_to_school', 'school_to_student');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'past_due', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."language_skill" AS ENUM('listening', 'reading', 'speaking', 'writing', 'vocabulary', 'grammar', 'phonetics');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'teacher', 'student', 'guardian');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'left');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('not_started', 'pending', 'active', 'restricted', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'sepa_debit', 'bank_transfer', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('requested_by_customer', 'service_not_provided', 'duplicate', 'fraudulent', 'goodwill');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'succeeded', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."respondent_kind" AS ENUM('student', 'teacher', 'guardian');--> statement-breakpoint
CREATE TYPE "public"."review_subject" AS ENUM('material', 'session', 'teacher');--> statement-breakpoint
CREATE TYPE "public"."room_provider" AS ENUM('livekit', 'zoom', 'google_meet', 'ms_teams', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."school_status" AS ENUM('trial', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'canceled_by_school', 'canceled_by_student', 'rescheduled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'paused', 'left');--> statement-breakpoint
CREATE TYPE "public"."survey_kind" AS ENUM('nps', 'csat', 'post_session', 'teacher_pulse');--> statement-breakpoint
CREATE TYPE "public"."teacher_status" AS ENUM('active', 'on_leave', 'left');--> statement-breakpoint
CREATE TYPE "public"."teacher_tier" AS ENUM('community', 'professional', 'specialist');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'blocked_no_consent');--> statement-breakpoint
CREATE TYPE "public"."block_type" AS ENUM('hero', 'courses', 'teachers', 'pricing', 'testimonials', 'faq', 'contact', 'text');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'placement_sent', 'placement_done', 'contacted', 'converted', 'cold', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('draft', 'published', 'unpublished');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"token" text NOT NULL,
	"locale" text,
	"invited_by_membership_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"locale" text,
	"invited_by_membership_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "school_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"country" text DEFAULT 'ES' NOT NULL,
	"default_locale" text DEFAULT 'es-ES' NOT NULL,
	"supported_locales" text[] DEFAULT ARRAY['es-ES']::text[] NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" "school_status" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"billing_customer_ref" text,
	"merchant_status" "merchant_status" DEFAULT 'not_started' NOT NULL,
	"merchant_ref" text,
	"merchant_onboarded_at" timestamp with time zone,
	"application_fee_enabled" boolean DEFAULT false NOT NULL,
	"application_fee_bps" integer DEFAULT 0 NOT NULL,
	"application_fee_cap_cents" integer,
	"ai_credits_balance" integer DEFAULT 0 NOT NULL,
	"ai_hard_limit" boolean DEFAULT true NOT NULL,
	"video_beta_enabled" boolean DEFAULT false NOT NULL,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_retention_days" integer DEFAULT 180 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"name" text NOT NULL,
	"locale" text DEFAULT 'es-ES' NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"avatar_url" text,
	"auth_provider" text DEFAULT 'password' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"subject_membership_id" uuid NOT NULL,
	"kind" "consent_kind" NOT NULL,
	"status" "consent_status" DEFAULT 'pending' NOT NULL,
	"granted_by_membership_id" uuid,
	"granted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"policy_version" text DEFAULT '1.0' NOT NULL,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"relationship" "guardian_relationship" NOT NULL,
	"is_billing_contact" boolean DEFAULT true NOT NULL,
	"can_give_consent" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"date_of_birth" date NOT NULL,
	"guardian_required" boolean DEFAULT false NOT NULL,
	"native_language" text NOT NULL,
	"target_language" text NOT NULL,
	"current_level" "cefr_level",
	"target_level" "cefr_level",
	"goals" text,
	"status" "student_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_until" date,
	"left_at" timestamp with time zone,
	"left_reason" text,
	"billing_contact_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_profile_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"tier" "teacher_tier" DEFAULT 'professional' NOT NULL,
	"bio" text,
	"languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"certifications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"is_native_speaker" boolean DEFAULT false NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"contracted_hours_week" smallint DEFAULT 20 NOT NULL,
	"status" "teacher_status" DEFAULT 'active' NOT NULL,
	"hired_at" date NOT NULL,
	"left_at" timestamp with time zone,
	"left_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" text NOT NULL,
	"language" text NOT NULL,
	"level" "cefr_level" NOT NULL,
	"modality" "course_modality" DEFAULT 'group' NOT NULL,
	"total_sessions" integer DEFAULT 50 NOT NULL,
	"session_minutes" smallint DEFAULT 60 NOT NULL,
	"max_students" smallint DEFAULT 5 NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"agreed_price_cents" integer,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"transferred_to_group_id" uuid
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"teacher_profile_id" uuid,
	"name" text NOT NULL,
	"capacity" smallint DEFAULT 5 NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"status" "group_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"source" "attendance_source" DEFAULT 'manual' NOT NULL,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"minutes_present" integer,
	"note" text,
	"recorded_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"rrule" text NOT NULL,
	"timezone" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"teacher_profile_id" uuid,
	"recurrence_id" uuid,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone NOT NULL,
	"actual_start" timestamp with time zone,
	"actual_end" timestamp with time zone,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"topic" text,
	"content_unit_id" uuid,
	"room_provider" "room_provider" DEFAULT 'livekit' NOT NULL,
	"room_url" text,
	"room_external_id" text,
	"canceled_at" timestamp with time zone,
	"canceled_by_membership_id" uuid,
	"cancel_reason" text,
	"cancel_notice_hours" smallint,
	"cancel_refund_due" boolean,
	"rescheduled_from_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"content_unit_id" uuid NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"provider" text DEFAULT 'upload' NOT NULL,
	"is_beta" boolean DEFAULT false NOT NULL,
	"alt_text" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_unit_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"content_unit_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"body" text,
	"machine_translated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"course_id" uuid,
	"code" text NOT NULL,
	"language" text NOT NULL,
	"level" "cefr_level" NOT NULL,
	"skills" "language_skill"[] DEFAULT ARRAY[]::language_skill[] NOT NULL,
	"topic" text NOT NULL,
	"source" "content_source" DEFAULT 'ai_generated' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"primary_locale" text NOT NULL,
	"generation_cost_cents" integer DEFAULT 0 NOT NULL,
	"credits_spent" integer DEFAULT 0 NOT NULL,
	"created_by_membership_id" uuid,
	"reviewed_by_membership_id" uuid,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"instructions" text NOT NULL,
	"machine_translated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"content_unit_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"type" "exercise_type" NOT NULL,
	"skill" "language_skill" NOT NULL,
	"level" "cefr_level" NOT NULL,
	"prompt" jsonb NOT NULL,
	"solution" jsonb,
	"rubric_id" uuid,
	"max_score" smallint DEFAULT 1 NOT NULL,
	"max_attempts" smallint DEFAULT 3 NOT NULL,
	"srs_enabled" boolean DEFAULT false NOT NULL,
	"requires_teacher_validation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"max_score" smallint DEFAULT 20 NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"ease" real DEFAULT 2.5 NOT NULL,
	"interval_days" smallint DEFAULT 1 NOT NULL,
	"repetitions" smallint DEFAULT 0 NOT NULL,
	"lapses" smallint DEFAULT 0 NOT NULL,
	"due_on" date NOT NULL,
	"last_reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" "assessment_kind" NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"course_id" uuid,
	"content_unit_id" uuid,
	"title" text NOT NULL,
	"language" text NOT NULL,
	"level_before" "cefr_level",
	"level_result" "cefr_level",
	"score" real,
	"max_score" real,
	"skill_breakdown" jsonb,
	"status" "assessment_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"graded_at" timestamp with time zone,
	"validated_by_membership_id" uuid,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"session_id" uuid,
	"assessment_id" uuid,
	"attempt_number" smallint DEFAULT 1 NOT NULL,
	"response" jsonb NOT NULL,
	"status" "attempt_status" DEFAULT 'submitted' NOT NULL,
	"ai_score" real,
	"ai_feedback" text,
	"ai_rubric_scores" jsonb,
	"ai_model" text,
	"ai_cost_cents" integer DEFAULT 0 NOT NULL,
	"teacher_score" real,
	"teacher_feedback" text,
	"validated_by_membership_id" uuid,
	"validated_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_profile_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"progress_rating" smallint NOT NULL,
	"level_at_evaluation" "cefr_level",
	"strengths" text,
	"improvements" text,
	"next_steps" text,
	"visible_to_student" boolean DEFAULT true NOT NULL,
	"visible_to_guardian" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"author_membership_id" uuid NOT NULL,
	"subject" "review_subject" NOT NULL,
	"content_unit_id" uuid,
	"session_id" uuid,
	"teacher_profile_id" uuid,
	"rating" smallint NOT NULL,
	"comment" text,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"respondent_membership_id" uuid NOT NULL,
	"respondent_kind" "respondent_kind" NOT NULL,
	"session_id" uuid,
	"teacher_profile_id" uuid,
	"score" smallint NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" "survey_kind" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"audience" "respondent_kind" NOT NULL,
	"auto_send_after_session" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"ai_generation_id" uuid,
	"invoice_id" uuid,
	"note" text,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"course_id" uuid,
	"session_id" uuid,
	"position" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"direction" "invoice_direction" NOT NULL,
	"student_profile_id" uuid,
	"bill_to_membership_id" uuid,
	"number" text NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"locale" text DEFAULT 'es-ES' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"application_fee_bps" integer DEFAULT 0 NOT NULL,
	"application_fee_cents" integer DEFAULT 0 NOT NULL,
	"issued_on" date,
	"due_on" date,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"provider_ref" text,
	"pdf_storage_key" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" "payment_method" DEFAULT 'card' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"application_fee_cents" integer DEFAULT 0 NOT NULL,
	"provider" "payment_provider" DEFAULT 'stripe' NOT NULL,
	"provider_ref" text,
	"merchant_ref" text,
	"paid_at" timestamp with time zone,
	"failure_code" text,
	"failure_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"interval" "billing_interval" DEFAULT 'month' NOT NULL,
	"max_active_students" integer,
	"included_ai_credits" integer DEFAULT 0 NOT NULL,
	"default_application_fee_bps" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_ref" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"reverses_application_fee" boolean DEFAULT true NOT NULL,
	"application_fee_reversed_cents" integer DEFAULT 0 NOT NULL,
	"provider_ref" text,
	"requested_by_membership_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"speaker_membership_id" uuid,
	"speaker_label" text,
	"text" text NOT NULL,
	"confidence_bps" integer,
	"is_teacher" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "transcript_status" DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'livekit' NOT NULL,
	"language" text NOT NULL,
	"duration_ms" integer,
	"summary" text,
	"vocabulary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_reason" text,
	"recording_storage_key" text,
	"recording_deleted_at" timestamp with time zone,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" "ai_generation_kind" NOT NULL,
	"status" "ai_generation_status" DEFAULT 'queued' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"units_produced" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"content_unit_id" uuid,
	"requested_by_membership_id" uuid,
	"origin" text DEFAULT 'app' NOT NULL,
	"error_code" text,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"actor_kind" "actor_kind" DEFAULT 'user' NOT NULL,
	"actor_membership_id" uuid,
	"mcp_client_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text,
	"redirect_uris" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"client_kind" text DEFAULT 'custom' NOT NULL,
	"authorized_by_membership_id" uuid,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"locale" text DEFAULT 'es-ES' NOT NULL,
	"message" text,
	"interested_language" text,
	"declared_level" "cefr_level",
	"placement_level" "cefr_level",
	"placement_score" integer,
	"suggested_course_id" uuid,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"source_page" text,
	"source_campaign" text,
	"referrer" text,
	"converted_student_profile_id" uuid,
	"converted_at" timestamp with time zone,
	"assigned_to_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"discarded_reason" text
);
--> statement-breakpoint
CREATE TABLE "mcp_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"mcp_client_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"access_token_hash" text NOT NULL,
	"refresh_token_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"language" text NOT NULL,
	"level" "cefr_level" NOT NULL,
	"skill" text NOT NULL,
	"difficulty_bps" integer DEFAULT 5000 NOT NULL,
	"prompt" jsonb NOT NULL,
	"solution" jsonb NOT NULL,
	"times_used" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"type" "block_type" NOT NULL,
	"position" smallint NOT NULL,
	"content" jsonb NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"meta_description" text,
	"is_home" boolean DEFAULT false NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"status" "site_status" DEFAULT 'draft' NOT NULL,
	"primary_locale" text NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_membership_id_memberships_id_fk" FOREIGN KEY ("invited_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_domains" ADD CONSTRAINT "school_domains_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_subject_membership_id_memberships_id_fk" FOREIGN KEY ("subject_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_granted_by_membership_id_memberships_id_fk" FOREIGN KEY ("granted_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_billing_contact_membership_id_memberships_id_fk" FOREIGN KEY ("billing_contact_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_translations" ADD CONSTRAINT "course_translations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_translations" ADD CONSTRAINT "course_translations_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_membership_id_memberships_id_fk" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recurrences" ADD CONSTRAINT "session_recurrences_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recurrences" ADD CONSTRAINT "session_recurrences_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_recurrence_id_session_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."session_recurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_canceled_by_membership_id_memberships_id_fk" FOREIGN KEY ("canceled_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_unit_translations" ADD CONSTRAINT "content_unit_translations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_unit_translations" ADD CONSTRAINT "content_unit_translations_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_units" ADD CONSTRAINT "content_units_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_units" ADD CONSTRAINT "content_units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_units" ADD CONSTRAINT "content_units_created_by_membership_id_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_units" ADD CONSTRAINT "content_units_reviewed_by_membership_id_memberships_id_fk" FOREIGN KEY ("reviewed_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_translations" ADD CONSTRAINT "exercise_translations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_translations" ADD CONSTRAINT "exercise_translations_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_rubric_id_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_validated_by_membership_id_memberships_id_fk" FOREIGN KEY ("validated_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_validated_by_membership_id_memberships_id_fk" FOREIGN KEY ("validated_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_membership_id_memberships_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_acknowledged_by_membership_id_memberships_id_fk" FOREIGN KEY ("acknowledged_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_membership_id_memberships_id_fk" FOREIGN KEY ("respondent_membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_created_by_membership_id_memberships_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bill_to_membership_id_memberships_id_fk" FOREIGN KEY ("bill_to_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_membership_id_memberships_id_fk" FOREIGN KEY ("requested_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_speaker_membership_id_memberships_id_fk" FOREIGN KEY ("speaker_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_content_unit_id_content_units_id_fk" FOREIGN KEY ("content_unit_id") REFERENCES "public"."content_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_requested_by_membership_id_memberships_id_fk" FOREIGN KEY ("requested_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_membership_id_memberships_id_fk" FOREIGN KEY ("actor_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_clients" ADD CONSTRAINT "mcp_clients_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_clients" ADD CONSTRAINT "mcp_clients_authorized_by_membership_id_memberships_id_fk" FOREIGN KEY ("authorized_by_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_suggested_course_id_courses_id_fk" FOREIGN KEY ("suggested_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("converted_student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_membership_id_memberships_id_fk" FOREIGN KEY ("assigned_to_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorizations" ADD CONSTRAINT "mcp_authorizations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_authorizations" ADD CONSTRAINT "mcp_authorizations_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_items" ADD CONSTRAINT "placement_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_blocks" ADD CONSTRAINT "site_blocks_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_blocks" ADD CONSTRAINT "site_blocks_page_id_site_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."site_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_uq" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_school_ix" ON "invitations" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_school_user_role_uq" ON "memberships" USING btree ("school_id","user_id","role");--> statement-breakpoint
CREATE INDEX "memberships_school_ix" ON "memberships" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "memberships_user_ix" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_domains_hostname_uq" ON "school_domains" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "school_domains_school_ix" ON "school_domains" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_slug_uq" ON "schools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "schools_status_ix" ON "schools" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "consents_subject_kind_uq" ON "consents" USING btree ("subject_membership_id","kind");--> statement-breakpoint
CREATE INDEX "consents_school_ix" ON "consents" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "consents_school_kind_status_ix" ON "consents" USING btree ("school_id","kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_student_membership_uq" ON "guardians" USING btree ("student_profile_id","membership_id");--> statement-breakpoint
CREATE INDEX "guardians_school_ix" ON "guardians" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_membership_uq" ON "student_profiles" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "student_profiles_school_ix" ON "student_profiles" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "student_profiles_school_status_ix" ON "student_profiles" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "teacher_availability_teacher_ix" ON "teacher_availability" USING btree ("teacher_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_profiles_membership_uq" ON "teacher_profiles" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "teacher_profiles_school_ix" ON "teacher_profiles" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "teacher_profiles_school_status_ix" ON "teacher_profiles" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "course_translations_course_locale_uq" ON "course_translations" USING btree ("course_id","locale");--> statement-breakpoint
CREATE INDEX "course_translations_school_ix" ON "course_translations" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_school_code_uq" ON "courses" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "courses_school_ix" ON "courses" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "courses_school_language_level_ix" ON "courses" USING btree ("school_id","language","level");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_group_student_uq" ON "enrollments" USING btree ("group_id","student_profile_id");--> statement-breakpoint
CREATE INDEX "enrollments_school_ix" ON "enrollments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_ix" ON "enrollments" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "groups_school_ix" ON "groups" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "groups_school_status_ix" ON "groups" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "groups_teacher_ix" ON "groups" USING btree ("teacher_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_student_uq" ON "attendance" USING btree ("session_id","student_profile_id");--> statement-breakpoint
CREATE INDEX "attendance_school_ix" ON "attendance" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "attendance_student_ix" ON "attendance" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "session_recurrences_school_ix" ON "session_recurrences" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sessions_school_ix" ON "sessions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sessions_school_start_ix" ON "sessions" USING btree ("school_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "sessions_group_ix" ON "sessions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "sessions_teacher_start_ix" ON "sessions" USING btree ("teacher_profile_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "sessions_status_ix" ON "sessions" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "content_assets_unit_ix" ON "content_assets" USING btree ("content_unit_id");--> statement-breakpoint
CREATE INDEX "content_assets_school_ix" ON "content_assets" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_unit_translations_unit_locale_uq" ON "content_unit_translations" USING btree ("content_unit_id","locale");--> statement-breakpoint
CREATE INDEX "content_unit_translations_school_ix" ON "content_unit_translations" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_units_school_code_uq" ON "content_units" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "content_units_school_ix" ON "content_units" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "content_units_school_status_ix" ON "content_units" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "content_units_level_ix" ON "content_units" USING btree ("school_id","language","level");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_translations_exercise_locale_uq" ON "exercise_translations" USING btree ("exercise_id","locale");--> statement-breakpoint
CREATE INDEX "exercise_translations_school_ix" ON "exercise_translations" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_unit_position_uq" ON "exercises" USING btree ("content_unit_id","position");--> statement-breakpoint
CREATE INDEX "exercises_school_ix" ON "exercises" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "exercises_type_ix" ON "exercises" USING btree ("school_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "rubrics_school_code_uq" ON "rubrics" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "srs_cards_student_exercise_uq" ON "srs_cards" USING btree ("student_profile_id","exercise_id");--> statement-breakpoint
CREATE INDEX "srs_cards_school_due_ix" ON "srs_cards" USING btree ("school_id","due_on");--> statement-breakpoint
CREATE INDEX "assessments_school_ix" ON "assessments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "assessments_student_ix" ON "assessments" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "assessments_school_kind_ix" ON "assessments" USING btree ("school_id","kind");--> statement-breakpoint
CREATE INDEX "attempts_school_ix" ON "attempts" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "attempts_student_ix" ON "attempts" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "attempts_exercise_ix" ON "attempts" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "attempts_school_status_ix" ON "attempts" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "evaluations_school_ix" ON "evaluations" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "evaluations_student_ix" ON "evaluations" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "evaluations_teacher_period_ix" ON "evaluations" USING btree ("teacher_profile_id","period_end");--> statement-breakpoint
CREATE INDEX "reviews_school_ix" ON "reviews" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "reviews_teacher_ix" ON "reviews" USING btree ("teacher_profile_id");--> statement-breakpoint
CREATE INDEX "reviews_unit_ix" ON "reviews" USING btree ("content_unit_id");--> statement-breakpoint
CREATE INDEX "reviews_school_rating_ix" ON "reviews" USING btree ("school_id","rating");--> statement-breakpoint
CREATE INDEX "survey_responses_school_ix" ON "survey_responses" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_ix" ON "survey_responses" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_responses_teacher_ix" ON "survey_responses" USING btree ("teacher_profile_id");--> statement-breakpoint
CREATE INDEX "survey_responses_school_submitted_ix" ON "survey_responses" USING btree ("school_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "surveys_school_code_uq" ON "surveys" USING btree ("school_id","code");--> statement-breakpoint
CREATE INDEX "credit_ledger_school_ix" ON "credit_ledger" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_school_created_ix" ON "credit_ledger" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_ix" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_school_ix" ON "invoice_lines" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_school_number_uq" ON "invoices" USING btree ("school_id","number");--> statement-breakpoint
CREATE INDEX "invoices_school_ix" ON "invoices" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "invoices_school_status_ix" ON "invoices" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "invoices_student_ix" ON "invoices" USING btree ("student_profile_id");--> statement-breakpoint
CREATE INDEX "payments_school_ix" ON "payments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_ix" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_school_status_ix" ON "payments" USING btree ("school_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_uq" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "refunds_school_ix" ON "refunds" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_ix" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "subscriptions_school_ix" ON "subscriptions" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_ref_uq" ON "subscriptions" USING btree ("provider_ref");--> statement-breakpoint
CREATE INDEX "transcript_segments_transcript_ix" ON "transcript_segments" USING btree ("transcript_id","start_ms");--> statement-breakpoint
CREATE INDEX "transcript_segments_school_ix" ON "transcript_segments" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcripts_session_uq" ON "transcripts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "transcripts_school_ix" ON "transcripts" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "transcripts_school_status_ix" ON "transcripts" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "transcripts_retention_ix" ON "transcripts" USING btree ("retention_until");--> statement-breakpoint
CREATE INDEX "ai_generations_school_created_ix" ON "ai_generations" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_generations_school_kind_ix" ON "ai_generations" USING btree ("school_id","kind");--> statement-breakpoint
CREATE INDEX "ai_generations_status_ix" ON "ai_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_school_created_ix" ON "audit_logs" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_ix" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_ix" ON "audit_logs" USING btree ("actor_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_clients_client_id_uq" ON "mcp_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "mcp_clients_school_ix" ON "mcp_clients" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "leads_school_status_ix" ON "leads" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "leads_school_created_ix" ON "leads" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_authorizations_school_ix" ON "mcp_authorizations" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "mcp_authorizations_client_ix" ON "mcp_authorizations" USING btree ("mcp_client_id");--> statement-breakpoint
CREATE INDEX "placement_items_school_lang_level_ix" ON "placement_items" USING btree ("school_id","language","level");--> statement-breakpoint
CREATE UNIQUE INDEX "site_blocks_page_position_uq" ON "site_blocks" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "site_blocks_school_ix" ON "site_blocks" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_site_slug_locale_uq" ON "site_pages" USING btree ("site_id","slug","locale");--> statement-breakpoint
CREATE INDEX "site_pages_school_ix" ON "site_pages" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_school_uq" ON "sites" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "sites_status_ix" ON "sites" USING btree ("status");