CREATE TABLE "experience_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	CONSTRAINT "experience_reviews_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "experience_reviews_rating_range" CHECK ("experience_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experience_reviews_created_at_idx" ON "experience_reviews" USING btree ("created_at");