CREATE TABLE IF NOT EXISTS "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"max_agent_turns" integer NOT NULL,
	"agent_turns_used" integer DEFAULT 1 NOT NULL,
	"max_interventions" integer NOT NULL,
	"interventions_used" integer DEFAULT 0 NOT NULL,
	"beat_index" integer DEFAULT 0 NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"script" jsonb NOT NULL,
	"current_code" text,
	"last_evidence" jsonb,
	"final_code" text,
	"status" "turn_session_status" DEFAULT 'open' NOT NULL,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_sessions_user_idx" ON "agent_sessions" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_sessions_one_open_idx" ON "agent_sessions" USING btree ("user_id","exercise_id") WHERE status = 'open';
