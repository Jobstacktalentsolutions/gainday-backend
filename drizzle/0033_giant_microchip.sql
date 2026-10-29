CREATE TYPE "public"."analytics_audience" AS ENUM('ANONYMOUS', 'JOB_SEEKER', 'EMPLOYER');--> statement-breakpoint
ALTER TABLE "daily_visitor_stats" ADD COLUMN "anonymous_visitors" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visitor_stats" ADD COLUMN "job_seeker_visitors" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_visitor_stats" ADD COLUMN "employer_visitors" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "visitor_daily_activity" ADD COLUMN "audience" "analytics_audience" NOT NULL;--> statement-breakpoint
CREATE INDEX "visitor_daily_activity_audience_day_idx" ON "visitor_daily_activity" USING btree ("audience","day");