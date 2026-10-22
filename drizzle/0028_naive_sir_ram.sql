CREATE TYPE "public"."job_recommendation_run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TABLE "candidate_match_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" halfvec(3072) NOT NULL,
	CONSTRAINT "candidate_match_embeddings_candidate_id_unique" UNIQUE("candidate_id")
);
--> statement-breakpoint
CREATE TABLE "job_match_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" halfvec(3072) NOT NULL,
	CONSTRAINT "job_match_embeddings_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "job_recommendation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" "job_recommendation_run_status" NOT NULL,
	"jobs_considered" integer DEFAULT 0 NOT NULL,
	"recommendations_created" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "job_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"score" real NOT NULL,
	CONSTRAINT "job_recommendations_candidate_job_unique" UNIQUE("candidate_id","job_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_seeker_profiles" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "candidate_match_embeddings" ADD CONSTRAINT "candidate_match_embeddings_candidate_id_job_seeker_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match_embeddings" ADD CONSTRAINT "job_match_embeddings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_recommendations" ADD CONSTRAINT "job_recommendations_candidate_id_job_seeker_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_recommendations" ADD CONSTRAINT "job_recommendations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_recommendations" ADD CONSTRAINT "job_recommendations_run_id_job_recommendation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."job_recommendation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_recommendation_runs_status_started_idx" ON "job_recommendation_runs" USING btree ("status","started_at");