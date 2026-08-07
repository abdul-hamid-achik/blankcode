-- Sign-in methods that are not a password. Rows rather than columns on `users`
-- because an account may have several, and "how many ways can this person get
-- in" — the question that decides whether unlinking is safe — should be a
-- count, not a computation over an ever-growing set of columns.
CREATE TABLE IF NOT EXISTS "linked_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linked_identities" ADD CONSTRAINT "linked_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- One provider account belongs to exactly one user: without this a second
-- sign-in could attach the same GitHub account to a different local user.
CREATE UNIQUE INDEX IF NOT EXISTS "linked_identities_provider_account_idx" ON "linked_identities" USING btree ("provider","provider_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "linked_identities_user_provider_idx" ON "linked_identities" USING btree ("user_id","provider");
