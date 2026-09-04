ALTER TABLE "jobs" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "required_skills" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "role" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "skill_level" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "location" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "employment_type" DROP NOT NULL;