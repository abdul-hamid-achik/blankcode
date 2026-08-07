-- Billing state on the user: at most one subscription each, and every question
-- is "can this person do the thing", which should not need a join.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" varchar(40);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_price_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_ends_at" timestamp with time zone;
--> statement-breakpoint
-- Webhooks arrive keyed by the Stripe customer, never by our user id.
CREATE INDEX IF NOT EXISTS "users_stripe_customer_idx" ON "users" USING btree ("stripe_customer_id");
