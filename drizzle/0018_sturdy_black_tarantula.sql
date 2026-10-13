CREATE TYPE "public"."credit_purchase_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_entry_type" AS ENUM('PURCHASE', 'UNLOCK');--> statement-breakpoint
CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"employer_id" uuid NOT NULL,
	"pack_id" varchar(50) NOT NULL,
	"credits" integer NOT NULL,
	"price_pence" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"stripe_checkout_session_id" varchar(255) NOT NULL,
	"status" "credit_purchase_status" DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "credit_purchases_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"employer_id" uuid NOT NULL,
	"type" "credit_ledger_entry_type" NOT NULL,
	"amount" integer NOT NULL,
	"credit_purchase_id" uuid,
	"submission_id" uuid,
	CONSTRAINT "credit_ledger_entries_credit_purchase_id_unique" UNIQUE("credit_purchase_id"),
	CONSTRAINT "credit_ledger_entries_amount_sign" CHECK (("credit_ledger_entries"."type" = 'PURCHASE' AND "credit_ledger_entries"."amount" > 0 AND "credit_ledger_entries"."credit_purchase_id" IS NOT NULL) OR ("credit_ledger_entries"."type" = 'UNLOCK' AND "credit_ledger_entries"."amount" < 0))
);
--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_employer_id_employer_profiles_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_employer_id_employer_profiles_id_fk" FOREIGN KEY ("employer_id") REFERENCES "public"."employer_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_credit_purchase_id_credit_purchases_id_fk" FOREIGN KEY ("credit_purchase_id") REFERENCES "public"."credit_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_employer_idx" ON "credit_ledger_entries" USING btree ("employer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_unlock_unique" ON "credit_ledger_entries" USING btree ("employer_id","submission_id") WHERE "credit_ledger_entries"."type" = 'UNLOCK';--> statement-breakpoint
ALTER TABLE "submissions" DROP COLUMN "is_unlocked";