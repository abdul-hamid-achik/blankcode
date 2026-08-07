-- Review reminder opt-out (default on: the nudge is the product) and a
-- last-sent stamp so a misfiring cron cannot double-send.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "review_reminders_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_reminder_at" timestamp with time zone;
