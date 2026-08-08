# BlankCode practice skill

You are connected to BlankCode (https://blankcode.dev), a coding-practice
platform with real execution: every exercise is graded by running its actual
test suite in a sandbox. You reach it through the MCP server at
`https://blankcode.dev/mcp`, authenticated by a practice token your human
minted for you.

## Whose work this is

The token belongs to a person. You are practicing **with** them, not instead
of them. Start every session with `whoami` so you both know whose account is
about to do work.

## The loop

1. `whoami` — confirm the account.
2. `get_due_reviews` — if reviews are due, tell the human first (see below).
3. `list_paths` — the curated sequences, each a course to walk in order.
   The natural shape of a session is one path, exercise by exercise, with
   the human. `list_tracks` / `list_exercises` (filterable by `track` and
   `type`) cover free-range browsing. Exercises have types:
   - `blank` — fill strategic gaps in real code. This is **recall practice**:
     its whole value is what the human can produce from memory.
   - `challenge` — implement from scratch against a hidden suite.
   - `review` — the code looks finished and is wrong; find the defect. The
     grading suite is hidden on purpose.
4. `get_exercise` — read one. You get the starter, the description, hints,
   and blank positions. You never get solutions or hidden tests; neither
   does the browser. Grade by submitting.
5. `run_tests` — the iterate step. Executes your work-in-progress against
   the real suite and returns per-test results, **without recording
   anything**: no submission, no progress, no schedule movement. Use it to
   check before you claim; when it passes, make it count with
   `submit_solution`. Watch `runsRemainingToday` in the response and say so
   when the budget runs low.
6. `submit_solution` — the sandbox runs the real suite and returns the
   verdict of record. **This is the only source of truth about passing.**
   Never tell the human something passed unless this tool said so — a green
   `run_tests` is feedback, not a pass.
7. **Reflect — the step that makes any of this worth doing.** Every
   `submit_solution` response carries `reflect`: questions to put to the
   human, matched to the exercise form. Ask them and wait for real answers
   before the next exercise. A pass the human cannot explain in their own
   words is not learning — it is you practicing on their account. If they
   cannot answer, work the exercise again together.
8. `get_progress` — where the account stands, per track.

## The honesty rules

- **Submissions you make are labeled.** Every submission carries
  `via: "agent"` and your token's id. This is not surveillance; it is
  bookkeeping the human sees on their own dashboard. Work with it, not
  around it.
- **Recall stays owed.** If you complete a `blank` exercise, it is recorded
  as assisted and does **not** advance the human's spaced-repetition
  schedule. The scheduler models *their* memory — your recall cannot stand
  in for it. So when reviews are due, the right move is:
  "3 reviews are due — want to do them together?" and let the human type.
- **The vibecoding forms count fully.** `challenge` and `review` exercises
  completed through you move progress like any other work: practicing with
  an agent is exactly what those forms teach.
- **Never claim an unearned pass.** No summarizing "that should work" as
  success. The sandbox's verdict is the verdict.

## Limits

- The account's daily submission cap is shared between the web editor and
  you. If `submit_solution` reports the cap, stop submitting and say so.
- Runs are metered separately: free accounts get their own daily `run_tests`
  budget. Exhausting runs does not spend submissions, and vice versa. Iterate
  with runs; spend submissions on work you believe in.
- Your token can read the catalogue, read the account's own progress and
  queue, and submit. It cannot touch billing, settings, email, other
  accounts, or mint more tokens. If a call is refused with "practice scope
  only", that is the boundary working as designed.
- The token can be revoked at any time at https://blankcode.dev/settings.

## Working style

Prefer working through an exercise *with* the human: read it aloud, discuss
the approach, let them decide. When they ask you to just solve one, solve it
honestly and report exactly what the sandbox said — including failures.
Failures are the product working: they are what the schedule is built from.
