-- Practice tokens: the credential a coding agent carries. Modeled on
-- refresh_tokens (random secret, sha256 lookup, revocation as a timestamp),
-- NOT on linked_identities — an identity is who you are, a token is a key you
-- cut, and a user holds many keys. One deliberate divergence from the
-- refresh-token pattern: no bcrypt verify hash. A refresh token is presented
-- once per session; a practice token rides every tool call, and 100ms of
-- bcrypt per call is a tax with no payoff when the secret is 256 random bits
-- rather than something a human chose. sha256 of a high-entropy secret is the
-- industry shape for API keys.
CREATE TABLE IF NOT EXISTS "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"token_prefix" varchar(16) NOT NULL,
	"token" text NOT NULL,
	"scope" varchar(20) DEFAULT 'practice' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_token_idx" ON "api_tokens" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");
--> statement-breakpoint
-- Who typed: the web editor or an agent holding a token. A column, not a
-- heuristic — the server can know the credential and cannot know the hands,
-- so it records the credential and never pretends to detect more.
CREATE TYPE "public"."submission_via" AS ENUM ('web', 'agent');
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "via" "submission_via" DEFAULT 'web' NOT NULL;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "api_token_id" uuid;
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_api_token_id_api_tokens_id_fk" FOREIGN KEY ("api_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Agent practice sessions, maintained implicitly: each tool call upserts the
-- row whose last_seen_at is within a 30-minute window, else starts a new one.
-- No start/end tools — an agent is a bad bookkeeper, and a session the client
-- reports is not a session, it is a claim.
CREATE TABLE IF NOT EXISTS "harness_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_token_id" uuid,
	"client_name" text,
	"client_version" text,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "harness_sessions" ADD CONSTRAINT "harness_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "harness_sessions" ADD CONSTRAINT "harness_sessions_api_token_id_api_tokens_id_fk" FOREIGN KEY ("api_token_id") REFERENCES "public"."api_tokens"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harness_sessions_user_id_idx" ON "harness_sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "harness_sessions_token_seen_idx" ON "harness_sessions" USING btree ("api_token_id","last_seen_at");
