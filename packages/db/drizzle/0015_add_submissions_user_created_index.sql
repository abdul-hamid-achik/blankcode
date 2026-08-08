-- The weak-spots aggregation and the drill evidence query both filter
-- submissions by (user_id, created_at >= …). The table had single-column
-- indexes on each but no composite, so the planner picks one and filters the
-- rest by hand — fine at 10 rows per user, a table scan's cousin at 10,000.
CREATE INDEX IF NOT EXISTS "submissions_user_created_idx" ON "submissions" USING btree ("user_id","created_at");
