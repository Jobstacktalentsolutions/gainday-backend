CREATE TYPE "public"."job_role" AS ENUM('FINANCE', 'SALES');--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::text;--> statement-breakpoint
DROP TYPE "public"."job_status";--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('DRAFT', 'GENERATING', 'ACTIVE', 'INACTIVE', 'SHORTLIST_READY', 'GENERATION_FAILED', 'TERMINATED');--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."job_status";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE "public"."job_status" USING "status"::"public"."job_status";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "salary_range" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "application_deadline" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "role" "job_role";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "skill_level" varchar(100);--> statement-breakpoint
UPDATE "jobs" SET "role" = 'FINANCE' WHERE "role" IS NULL;--> statement-breakpoint
UPDATE "jobs" SET "skill_level" = 'Unspecified' WHERE "skill_level" IS NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "skill_level" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "skill_category" varchar(255);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "company_description" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "is_remote_friendly" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "role_category";