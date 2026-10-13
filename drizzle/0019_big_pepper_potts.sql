ALTER TYPE "public"."credit_ledger_entry_type" ADD VALUE 'SIGNUP_BONUS';--> statement-breakpoint
CREATE TABLE "signup_bonus_settings" (
	"id" varchar(20) PRIMARY KEY DEFAULT 'global' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credit_amount" integer DEFAULT 0 NOT NULL,
	"updated_by_admin_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_bonus_settings_singleton" CHECK ("signup_bonus_settings"."id" = 'global'),
	CONSTRAINT "signup_bonus_settings_credit_amount_non_negative" CHECK ("signup_bonus_settings"."credit_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" DROP CONSTRAINT "credit_ledger_entries_amount_sign";--> statement-breakpoint
ALTER TABLE "signup_bonus_settings" ADD CONSTRAINT "signup_bonus_settings_updated_by_admin_id_admin_profiles_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."admin_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_signup_bonus_unique" ON "credit_ledger_entries" USING btree ("employer_id") WHERE "credit_ledger_entries"."type" = 'SIGNUP_BONUS';--> statement-breakpoint
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_amount_sign" CHECK (("credit_ledger_entries"."type" = 'PURCHASE' AND "credit_ledger_entries"."amount" > 0 AND "credit_ledger_entries"."credit_purchase_id" IS NOT NULL) OR ("credit_ledger_entries"."type" = 'UNLOCK' AND "credit_ledger_entries"."amount" < 0) OR ("credit_ledger_entries"."type" = 'SIGNUP_BONUS' AND "credit_ledger_entries"."amount" > 0 AND "credit_ledger_entries"."credit_purchase_id" IS NULL));