CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('EMPLOYER', 'JOB_SEEKER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('DRAFT', 'GENERATING', 'ACTIVE', 'UNDER_REVIEW', 'SHORTLIST_READY', 'CLOSED', 'GENERATION_FAILED');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('PENDING', 'SCORING', 'SCORED', 'DISQUALIFIED');--> statement-breakpoint
CREATE TYPE "public"."generation_review_status" AS ENUM('PENDING', 'APPROVED_WITH_EDITS', 'REJECTED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255),
	"role" "user_role" NOT NULL,
	"auth_provider" "auth_provider" DEFAULT 'local' NOT NULL,
	"google_id" varchar(255),
	"full_name" varchar(255),
	"company_name" varchar(255),
	"phone_number" varchar(50),
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"email_verification_expires" timestamp with time zone,
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp with time zone,
	"capability_scores" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"required_skills" text[] NOT NULL,
	"role_category" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"employment_type" varchar(100) NOT NULL,
	"salary_range" jsonb NOT NULL,
	"application_deadline" timestamp with time zone NOT NULL,
	"business_problem" text NOT NULL,
	"status" "job_status" DEFAULT 'DRAFT' NOT NULL,
	"employer_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"tasks" jsonb NOT NULL,
	"time_limit_minutes" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "simulations_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL,
	"candidate_id" uuid,
	"guest_info" jsonb,
	"status" "submission_status" DEFAULT 'PENDING' NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overall_score" numeric(5, 2),
	"category_scores" jsonb,
	"time_taken_seconds" integer,
	"is_anti_cheat_flagged" boolean DEFAULT false NOT NULL,
	"anti_cheat_flags" text[],
	"disqualification_reason" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"is_unlocked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" varchar(255) NOT NULL,
	"sub_category" varchar(255),
	"intent" text NOT NULL,
	"task_type" varchar(100) NOT NULL,
	"task_content" jsonb NOT NULL,
	"anchors" jsonb NOT NULL,
	"source_job_id" uuid,
	"embedding" vector(3072) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"category" varchar(255) NOT NULL,
	"intent" text NOT NULL,
	"problem" text,
	"candidate_pool" jsonb NOT NULL,
	CONSTRAINT "job_extractions_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "generation_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"slot_index" integer NOT NULL,
	"category" varchar(255) NOT NULL,
	"attempts" jsonb NOT NULL,
	"status" "generation_review_status" DEFAULT 'PENDING' NOT NULL,
	"resolved_task_content" jsonb,
	"resolved_anchors" jsonb,
	"reviewed_by_admin_id" uuid,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_employer_id_users_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_source_job_id_jobs_id_fk" FOREIGN KEY ("source_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_extractions" ADD CONSTRAINT "job_extractions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_review_items" ADD CONSTRAINT "generation_review_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_review_items" ADD CONSTRAINT "generation_review_items_reviewed_by_admin_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_bank_category_idx" ON "question_bank" USING btree ("category");