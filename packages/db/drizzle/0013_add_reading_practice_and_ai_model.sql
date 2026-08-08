-- Reading practice (form R): you get a small codebase and explain what it
-- does; an AI grades your explanation against an authored rubric. Its own
-- tables rather than rows in `exercises`, because the shape shares nothing
-- with a code submission — there is no starter, no test suite, no sandbox —
-- and forcing it into that row would leave most columns lying.
CREATE TABLE IF NOT EXISTS "reading_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"brief" text NOT NULL,
	"language" varchar(20) NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"files" jsonb NOT NULL,
	"rubric" jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reading_exercises_slug_idx" ON "reading_exercises" USING btree ("slug");
--> statement-breakpoint
-- One row per attempt, kept forever: the rubric points a person keeps missing
-- are the seed of the per-user content generation the owner wants.
CREATE TABLE IF NOT EXISTS "reading_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reading_exercise_id" uuid NOT NULL,
	"explanation" text NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"rubric_results" jsonb NOT NULL,
	"model" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_submissions" ADD CONSTRAINT "reading_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reading_submissions" ADD CONSTRAINT "reading_submissions_reading_exercise_id_fk" FOREIGN KEY ("reading_exercise_id") REFERENCES "public"."reading_exercises"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reading_submissions_user_exercise_idx" ON "reading_submissions" USING btree ("user_id","reading_exercise_id");
--> statement-breakpoint
-- Which AI tier the user prefers for model-backed features (explanations,
-- turn sessions, reading grades). A tier name, never a raw gateway id — the
-- mapping lives in code so models can rotate without a migration.
ALTER TABLE "users" ADD COLUMN "ai_model" varchar(20);
