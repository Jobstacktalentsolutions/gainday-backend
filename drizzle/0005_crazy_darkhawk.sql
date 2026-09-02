ALTER TABLE "jobs" DROP CONSTRAINT "jobs_employer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_employer_profile_id_employer_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_candidate_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_candidate_profile_id_job_seeker_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_review_items" DROP CONSTRAINT "generation_review_items_reviewed_by_admin_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_review_items" DROP CONSTRAINT "generation_review_items_reviewed_by_admin_profile_id_admin_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "company_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "capability_scores";