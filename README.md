# BlankCode

A coding-practice platform, live at <https://blankcode.dev>. You read real code
with strategic gaps, fill in the blanks, and a sandboxed runner executes the
exercise's real test suite against your answer. Spaced repetition brings each
exercise back before you would have forgotten it.

BlankCode is a hosted service. This repository is where it is built; the setup
below is for working on it, not for running a copy of it.

## What is actually here

- **101 exercises** across six tracks (TypeScript, Python, Go, Rust, Vue,
  React), each with a reference solution that is executed in the sandbox by
  `content:verify` — an exercise that cannot be solved cannot ship.
- **Three exercise kinds**: `blank` (fill the gaps), `challenge` (write the
  whole thing against hidden tests), `review` (the code looks finished and is
  wrong; the starter must fail its own suite or the build rejects it).
- **Vibecoding practice** — working with AI agents as a trained skill, in seven
  forms: specifying, reviewing, prompting under a turn budget, debugging,
  context selection, building tools, and root-causing the error that is not
  the error. The turn-budget and context-selection forms have full server
  flows (`turn_sessions`, `context_sessions`) graded by the same hidden-test
  sandbox as everything else.
- **Spaced repetition** (SM-2: the 1/3/8/20/50/125-day ladder at default
  ease), with a daily reminder email whose opt-out lives in Settings.
- **Real execution**: every submission boots a Vercel Sandbox microVM
  (1 vCPU, ~3s, destroyed after). Per-language snapshots are kept warm by a
  weekly cron so they never expire.
- **Auth**: email+password and OAuth (GitHub, Google), linkable per account in
  Settings; the last sign-in method cannot be removed.
- **Billing**: Stripe, MXN-based price with explicit USD/EUR amounts, free
  tier enforced server-side (10 submissions/day, 3 AI explanations/day).
- **Content**: markdown everywhere — exercises import into Postgres, blog and
  tutorials render via @nuxt/content with build-time Shiki highlighting.
  Tutorials carry interactive fill-in-the-blank checkpoints (`::code-blank`),
  graded client-side mid-read and linking to the graded exercises — the
  authoring contract lives in AGENTS.md (Tutorial Authoring Rules).

## Layout

```
apps/web         Nuxt 4 site + Nitro server routes (OAuth, billing, sessions,
                 admin, crons). The Effect API is mounted under /api.
apps/api         Effect HttpApi: auth, exercises (redacted — hidden tests
                 never leave the server), submissions (createAndExecute runs
                 the sandbox inline), reviews, tracks, paths.
packages/db      Drizzle schema + migrations.
packages/shared  Types, schemas, entitlement rules, blank grading.
packages/exercise-parser   Markdown → starter/solution/blanks/tests.
tools/ops        Recurring operator tooling: `seed.ts` (Stripe/tvault/Vercel
                 reconciliation), `dev-against-preview.sh`. One-time scripts
                 are never committed (AGENTS.md, Critical Rule 0).
tools/content-importer     content/tracks + LEARNING_PATHS → Postgres.
tools/exercise-validator   Static rules; also consumed by the generator.
tools/exercise-generator   AI generation, gated by the real validator.
content/         tracks/ (exercises), blog/, tutorials/.
```

## Development

```bash
bun install
bash tools/ops/dev-against-preview.sh   # writes .env.development.local
bun run dev                             # site on :3001, API under /api
```

The env script points `DATABASE_URL` at the **preview** Neon branch and sets
`EXECUTION_BACKEND=vercel-sandbox` with a fresh OIDC token, so a submission
runs in a real microVM from your machine. Secrets come from tvault
(`blankcode-preview`); the file is disposable — delete it and re-run.

### Gates

```bash
bun run verify           # lint (oxlint+oxfmt), typecheck, tests, knip
bun run content:validate # static exercise rules
bun run content:verify   # reference solutions actually run in the sandbox
bun run content:import   # content/tracks + paths → the DATABASE_URL you set
```

`content:verify` is the one that matters: this repository shipped eleven
unsolvable exercises that read fine, and four of five AI-generated ones passed
every static check while failing execution.

## Environments

| | git | Neon | domain |
|---|---|---|---|
| production | `main` | `main` | blankcode.dev |
| preview | `preview` | `preview` | preview.blankcode.dev |

Pushes to `main` deploy production. Pushes to `preview` deploy and re-point
preview.blankcode.dev (`.github/workflows/preview-domain.yml`). Migrations run
in CI on push when `packages/db` changes — preview automatically, production
behind a required reviewer (`.github/workflows/migrations.yml`), with secrets
delivered via tvault identity mode and sealed artifacts in `ci/`.

Operator changes (plan, prices, keys) are one command:

```bash
bun run seed             # sandbox Stripe → tvault + Vercel preview/dev
bun run seed -- --live   # live Stripe → tvault + Vercel production
```

It is an upsert and never prints a secret. Vercel reads new environment
variables only on a fresh build; `vercel redeploy` reuses the previous one.

## Exercise authoring

Exercises are markdown with YAML frontmatter under
`content/tracks/<track>/<concept>/`. The full rules live in AGENTS.md; the
ones that reject a file outright:

- blanks use `___blank_start___`/`___blank_end___`; a blank answer must not
  contain a quote character (per-blank feedback is an exact compare)
- challenges and reviews put the reference solution under `## Solution`
- a `review` exercise's starter must fail the suite
- `## Tests` is required, and a test with no assertion is a finding

AI generation (`bun run content:generate <track> <concept> <difficulty>
[topic]`) is gated by the same validator and defaults to a model measured to
hold the format. Generated exercises still go through `content:verify` before
import — the measured yield of generate-then-execute is one usable exercise in
five, which is why execution is not optional.

## The numbers that shape decisions

- A submission costs ~$0.00082 (the one-minute provisioned-memory floor is 87%
  of it — the reason sandboxes run 1 vCPU).
- Stripe in Mexico: 3.6% + MXN 3 + 0.5% international + 0.7% Billing, plus
  IVA. The price is MXN-based because a Mexican account settles only in MXN
  and Adaptive Pricing requires the price currency to be a settlement
  currency.
- A maxed-out free account costs ~$0.25/month.

## Docs and notes

`AGENTS.md` is the contract: architecture, design system, voice, authoring
rules, pre-flight checklist. `CLAUDE.md` is the short version agents load
first. Product thinking lives in Obsidian at `~/notes/projects/blankcode/`.
