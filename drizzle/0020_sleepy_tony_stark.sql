ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
UPDATE "submissions" SET "status" = 'GRADING' WHERE "status" = 'SCORING';--> statement-breakpoint
UPDATE "submissions" SET "status" = 'GRADED' WHERE "status" = 'SCORED';--> statement-breakpoint
DROP TYPE "public"."submission_status";--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('PENDING', 'GRADING', 'GRADED', 'DISQUALIFIED', 'WITHDRAWN', 'SELECTED', 'NOT_SELECTED');--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."submission_status";--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "status" SET DATA TYPE "public"."submission_status" USING "status"::"public"."submission_status";