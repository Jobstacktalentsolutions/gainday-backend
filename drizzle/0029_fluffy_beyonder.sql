CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_recommendations_enabled" boolean DEFAULT true NOT NULL,
	"newsletter_enabled" boolean DEFAULT true NOT NULL,
	"unsubscribe_token" varchar(64) NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "notification_preferences_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;