DO $$ BEGIN
 CREATE TYPE "ai_report_type" AS ENUM('progress', 'treatment_summary');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "ai_report_status" AS ENUM('draft', 'approved');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "ai_report_provider_outcome" AS ENUM('approved', 'discarded', 'edited_then_approved');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "ai_report_discard_reason" AS ENUM('clinically_inaccurate', 'missing_information', 'wrong_tone', 'formatting_issues', 'not_useful', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_clinical_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"provider_id" uuid,
	"patient_id" uuid NOT NULL,
	"report_type" "ai_report_type" NOT NULL,
	"status" "ai_report_status" DEFAULT 'draft' NOT NULL,
	"date_range_start" timestamp with time zone NOT NULL,
	"date_range_end" timestamp with time zone NOT NULL,
	"generated_content" jsonb NOT NULL,
	"edited_content" jsonb,
	"prompt_snapshot" text,
	"input_snapshot" jsonb,
	"output_snapshot" jsonb,
	"model_used" varchar(100) DEFAULT 'claude-sonnet-4-6',
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"generation_latency_ms" integer,
	"red_flags_detected" boolean DEFAULT false NOT NULL,
	"provider_outcome" "ai_report_provider_outcome",
	"provider_outcome_at" timestamp with time zone,
	"discard_reason" "ai_report_discard_reason",
	"discard_notes" text,
	"edit_distance_score" double precision,
	"pdf_s3_key" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT NOW() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_clinical_reports" ADD CONSTRAINT "ai_clinical_reports_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_clinical_reports" ADD CONSTRAINT "ai_clinical_reports_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_clinical_reports_patient_id_idx" ON "ai_clinical_reports" ("patient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_clinical_reports_provider_id_idx" ON "ai_clinical_reports" ("provider_id");
