ALTER TABLE "experience_reviews" DROP CONSTRAINT "experience_reviews_user_id_unique";--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experience_reviews_user_id_idx" ON "experience_reviews" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_submission_id_unique" UNIQUE("submission_id");