ALTER TABLE "jobs" ADD CONSTRAINT "jobs_employer_id_employer_profiles_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_candidate_id_job_seeker_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_review_items" ADD CONSTRAINT "generation_review_items_reviewed_by_admin_id_admin_profiles_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."admin_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "employer_profile_id";--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "candidate_profile_id";--> statement-breakpoint
ALTER TABLE "generation_review_items" DROP COLUMN "reviewed_by_admin_profile_id";