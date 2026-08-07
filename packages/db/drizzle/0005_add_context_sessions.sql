-- Context-selection attempts. Sources and their prices are snapshotted at
-- creation: an exercise that gains or reprices a source must not change the
-- cost of an attempt already under way, because a score that moves afterwards
-- is not a score.
CREATE TABLE IF NOT EXISTS "context_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" text,
	"status" "turn_session_status" DEFAULT 'open' NOT NULL,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "context_sessions" ADD CONSTRAINT "context_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "context_sessions" ADD CONSTRAINT "context_sessions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "context_sessions_user_idx" ON "context_sessions" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "context_sessions_one_open_idx" ON "context_sessions" USING btree ("user_id","exercise_id") WHERE status = 'open';
