-- Supervision exercises: a scripted in-platform agent, graded on catching
-- seeded failures. ADD VALUE only — same transaction must not use the value.
ALTER TYPE "public"."exercise_type" ADD VALUE IF NOT EXISTS 'agent';--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "agent_budget" integer;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "intervention_budget" integer;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "agent_script" jsonb;
