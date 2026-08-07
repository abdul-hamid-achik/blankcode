-- Metered actions, so a limit can be enforced across instances rather than
-- inside one. The AI explanation budget was a Map in the request handler: each
-- function instance kept its own, so the real ceiling was the limit times the
-- number of warm instances, and a cold start reset it.
CREATE TABLE IF NOT EXISTS "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_user_kind_created_idx" ON "usage_events" USING btree ("user_id","kind","created_at");
