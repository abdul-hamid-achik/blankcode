-- Turn-budget sessions. The state has to be server-side: a budget the browser
-- reports is not a budget, and the hidden tests are the entire grading
-- mechanism, so what has been revealed cannot be a client-side claim either.
CREATE TYPE "public"."turn_session_status" AS ENUM('open', 'submitted', 'abandoned');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "turn_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"max_turns" integer NOT NULL,
	"turns_used" integer DEFAULT 0 NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_code" text,
	"status" "turn_session_status" DEFAULT 'open' NOT NULL,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "turn_sessions" ADD CONSTRAINT "turn_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "turn_sessions" ADD CONSTRAINT "turn_sessions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "turn_sessions_user_idx" ON "turn_sessions" USING btree ("user_id","created_at");
--> statement-breakpoint
-- Partial: starting a second session for the same exercise to get a fresh
-- budget is precisely what the budget exists to prevent.
CREATE UNIQUE INDEX IF NOT EXISTS "turn_sessions_one_open_idx" ON "turn_sessions" USING btree ("user_id","exercise_id") WHERE status = 'open';
