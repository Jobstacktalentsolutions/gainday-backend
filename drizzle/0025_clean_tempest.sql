CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'NON_BINARY');--> statement-breakpoint
CREATE TYPE "public"."pronouns" AS ENUM('HE_HIM', 'SHE_HER', 'THEY_THEM');--> statement-breakpoint
ALTER TABLE "job_seeker_profiles" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "job_seeker_profiles" ADD COLUMN "pronouns" "pronouns";--> statement-breakpoint
ALTER TABLE "job_seeker_profiles" ADD COLUMN "brief" text;--> statement-breakpoint
ALTER TABLE "job_seeker_profiles" ADD COLUMN "is_profile_complete" boolean DEFAULT false NOT NULL;