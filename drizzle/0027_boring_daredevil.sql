CREATE TABLE "candidate_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "candidate_notifications" ADD CONSTRAINT "candidate_notifications_candidate_id_job_seeker_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_notifications_candidate_created_idx" ON "candidate_notifications" USING btree ("candidate_id","created_at");