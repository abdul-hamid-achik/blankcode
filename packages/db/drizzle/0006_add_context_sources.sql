-- Context-selection exercises carry their own menu of sources, with a price and
-- contents for each. On the exercise row rather than a table of its own because
-- it is authored content that changes with the markdown, and a separate table
-- would have to be kept in step with an import that already rewrites this row.
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "context_sources" jsonb;
