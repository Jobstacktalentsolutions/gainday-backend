CREATE TABLE "daily_visitor_stats" (
	"day" date PRIMARY KEY NOT NULL,
	"visitors" integer NOT NULL,
	"signed_in_users" integer NOT NULL,
	"new_visitors" integer NOT NULL,
	"sessions" integer NOT NULL,
	"page_views" integer NOT NULL,
	"rolling_30d_visitors" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_daily_activity" (
	"day" date NOT NULL,
	"visitor_id" uuid NOT NULL,
	"user_id" uuid,
	"sessions" integer NOT NULL,
	"page_views" integer NOT NULL,
	CONSTRAINT "visitor_daily_activity_day_visitor_id_pk" PRIMARY KEY("day","visitor_id")
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"first_seen_on" date NOT NULL,
	"last_seen_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor_daily_activity" ADD CONSTRAINT "visitor_daily_activity_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_daily_activity_user_day_idx" ON "visitor_daily_activity" USING btree ("user_id","day");