ALTER TABLE "users" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "submissions_candidate_job_idx" ON "submissions" USING btree ("candidate_id","job_id");