ALTER TABLE "submissions" ALTER COLUMN "anti_cheat_flags" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "anti_cheat_flags" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "anti_cheat_flags" SET NOT NULL;