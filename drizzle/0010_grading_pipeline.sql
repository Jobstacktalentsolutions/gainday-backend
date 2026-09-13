ALTER TABLE "submissions" ADD COLUMN "task_scores" jsonb;--> statement-breakpoint
ALTER TABLE "question_bank" ADD COLUMN "anchors_need_review" boolean DEFAULT false NOT NULL;