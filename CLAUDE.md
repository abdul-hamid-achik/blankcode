# BlankCode — project instructions

Read `AGENTS.md` first: it holds the architecture, the design system, the
exercise-authoring rules, the voice, and the pre-flight checklist. Everything
there applies to every session.

Three rules worth repeating because they were learned the expensive way:

- **No one-time scripts in the repository.** A thing that runs once runs from
  the scratchpad and is gone. Recurring operator tooling lives in `tools/ops/`
  (see AGENTS.md, Critical Rule 0).
- **No shell scripts, no `scripts/` folder.** Operator tooling is TypeScript
  run with bun; environment and secrets are tvault's job (`tvault run`), never
  a wrapper script's or a generated env file's. The one exception is a
  container entrypoint under `docker/`, where `/bin/sh` is all the image has.
- **Verify by executing, not by reading.** This codebase's history is a list of
  things that passed every static check and failed when run: exercises whose
  reference solutions did not compile, a validator that approved unparseable
  YAML, a demo that reported results nothing had computed, and a hydration
  mismatch on /progress that no static review caught. `content:verify` runs
  reference solutions in the real sandbox; UI regressions get a real browser
  (a Playwright sweep from the scratchpad — hard-load pages, grep the console
  for `hydrat|mismatch`; see AGENTS.md Common Pitfall 7).

Operator basics: secrets live in tvault (`blankcode`, `blankcode-preview`) and
are pushed with `bun run seed` (`-- --live` for production). Local development
against the preview database and real sandboxes: `tvault run -p
blankcode-preview -- bun run dev` — no env file; Sandbox and AI Gateway
credentials mint themselves from the Vercel CLI login (see AGENTS.md, Common
Pitfall 5). Git auto-builds **`preview` only**. Production is
`vercel promote <preview-url> --scope the-lacanians --yes` (no rebuild), then
merge `preview` → `main` for history. Promote keeps Preview baked env; if that
is unsafe for live Stripe/sandbox, `vercel deploy --prod` from the SHA. Vercel
only reads new environment variables on a fresh build — `vercel redeploy`
reuses the old one. Details: **Vercel Git and production releases** in AGENTS.md.

Content has a quality bar, written down. Exercises follow the authoring rules
in AGENTS.md; tutorials follow the Tutorial Authoring Rules there too — the
2026-08-08 rewrite is the reference: product voice, interactive
`::code-blank` checkpoints after the section they test, one non-obvious
insight per tutorial, claims verified by running them, and every page swept
rendered before shipping. Do not add content below that bar.
