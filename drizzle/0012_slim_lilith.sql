ALTER TABLE "jobs" ALTER COLUMN "role" SET DATA TYPE varchar(100);--> statement-breakpoint
DROP TYPE "public"."job_role";