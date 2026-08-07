-- The two vibecoding session forms stop masquerading as challenges. They were
-- imported as `challenge` because the enum had nothing truer to say, and the
-- editor opened them as plain exercises promising mechanics it does not have.
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the same
-- transaction does not USE the value — these two statements are the whole
-- migration, so that holds.
ALTER TYPE "public"."exercise_type" ADD VALUE IF NOT EXISTS 'turn';--> statement-breakpoint
ALTER TYPE "public"."exercise_type" ADD VALUE IF NOT EXISTS 'context';
