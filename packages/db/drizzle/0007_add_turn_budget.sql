-- Turn-budget exercises declare their own budget. It is the difficulty knob:
-- a three-turn task and a six-turn task are different exercises, not the same
-- one configured differently, so it belongs on the exercise and not in a
-- constant in the route.
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "turn_budget" integer;
