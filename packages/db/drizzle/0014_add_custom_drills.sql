-- Per-user generated drills: the weak-spots signal closing its loop. A drill
-- is authored by a model FROM the user's own failure pattern, then verified
-- the only way this repo trusts — by executing its reference solution against
-- its own tests in the real sandbox — before it is allowed to exist. Rows are
-- private to their user; solutions and tests never leave the server.
CREATE TABLE IF NOT EXISTS "custom_drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"concept_slug" varchar(100) NOT NULL,
	"track_slug" varchar(50) NOT NULL,
	"language" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"starter_code" text NOT NULL,
	"solution_code" text NOT NULL,
	"test_code" text NOT NULL,
	"blanks" jsonb NOT NULL,
	"source" jsonb NOT NULL,
	"model" varchar(60) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"solved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_drills" ADD CONSTRAINT "custom_drills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_drills_user_created_idx" ON "custom_drills" USING btree ("user_id","created_at");
