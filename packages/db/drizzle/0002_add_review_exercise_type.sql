-- `review` was added to EXERCISE_TYPES in the shared package, which is where the
-- pgEnum is derived from, but no migration ever taught the database about it.
-- Everything typechecked and every review exercise failed to import with
-- `invalid input value for enum exercise_type: "review"`.
--
-- Hand-written because drizzle-kit generate wants an interactive answer about an
-- unrelated table rename before it will emit anything.
ALTER TYPE "public"."exercise_type" ADD VALUE IF NOT EXISTS 'review';
