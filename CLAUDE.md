# BlankCode — project instructions

Read `AGENTS.md` first: it holds the architecture, the design system, the
exercise-authoring rules, the voice, and the pre-flight checklist. Everything
there applies to every session.

Two rules worth repeating because they were learned the expensive way:

- **No one-time scripts in the repository.** A thing that runs once runs from
  the scratchpad and is gone. Recurring operator tooling lives in `tools/ops/`
  (see AGENTS.md, Critical Rule 0).
- **Verify by executing, not by reading.** This codebase's history is a list of
  things that passed every static check and failed when run: exercises whose
  reference solutions did not compile, a validator that approved unparseable
  YAML, a demo that reported results nothing had computed. `content:verify`
  runs reference solutions in the real sandbox; use it before trusting new
  exercises.

Operator basics: secrets live in tvault (`blankcode`, `blankcode-preview`) and
are pushed with `bun run seed` (`-- --live` for production). Local development
against the preview database and real sandboxes: `bash
tools/ops/dev-against-preview.sh` then `bun run dev`. Vercel only reads new
environment variables on a fresh build — `vercel redeploy` reuses the old one.
