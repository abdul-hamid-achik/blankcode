# BlankCode

A self-hosted coding-practice platform. You read real code with strategic gaps,
fill in the blanks, and a sandboxed runner executes the exercise's real test
suite against your answer. Built to keep programming muscle memory alive across
several languages.

## Features

- **6 language tracks**: TypeScript, Python, Go, Rust, Vue, and React
- **Fill-in-the-blank exercises**: CodeMirror editor with inline blank widgets, Tab navigation, and per-blank feedback
- **Real test execution**: submissions run in a hardened Docker sandbox and the output is parsed per language
- **Spaced repetition**: SM-2 scheduler resurfaces exercises before you forget them
- **Progress tracking**: mastery levels, completion rates, streaks, achievements, and learning paths
- **AI exercise generation**: author new exercises through the Vercel AI Gateway (DeepSeek by default)

## Quick Start

```bash
git clone https://github.com/abdul-hamid-achik/blankcode.git
cd blankcode
bun install

# JWT_SECRET is required — the API refuses to boot without it
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env

# Postgres + API + web + worker + runner images
docker compose up -d

# Load the exercise content into the database
bun run content:import
```

Web app: <http://localhost:3001> · API: <http://localhost:3000>

### Running without Docker

Only Postgres is strictly required. Set `DOCKER_ENABLED=false` to execute
submissions directly on the host — much faster to iterate on, but **without
sandbox isolation**, so only do it with content you trust.

```bash
docker compose up -d postgres
bun run db:push
bun run content:import
bun run dev        # API on :3000, web on :3001
bun run worker     # separate terminal
```

## Prerequisites

- [Bun](https://bun.sh/) >= 1.3.7
- [Docker](https://www.docker.com/) and Docker Compose (for Postgres and the sandbox runners)
- Node.js >= 22 (some tooling shells out to it)

## Project Structure

```
blankcode/
├── apps/
│   ├── api/          # Effect.ts HttpApi server + submission worker
│   └── web/          # Nuxt 4 frontend
├── packages/
│   ├── db/           # Drizzle ORM schema and migrations
│   ├── shared/       # Shared types, schemas, and utilities
│   └── exercise-parser/  # Markdown exercise parser
├── tools/
│   ├── content-importer/   # CLI: markdown -> database
│   └── exercise-generator/ # CLI: AI-generated exercises
├── content/          # Exercise + tutorial content (markdown)
└── docker/runners/   # Per-language sandbox images
```

## Development

```bash
bun run dev          # API (:3000) + web (:3001)
bun run worker       # submission processor
bun run story        # Histoire component workshop (:6006)
bun run verify       # lint + typecheck + test + knip
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start API and web in watch mode |
| `bun run build` | Build every workspace |
| `bun run test` | Run all unit tests |
| `bun run verify` | Full gate: lint, typecheck, test, knip |
| `bun run lint` / `lint:fix` | oxlint + oxfmt check / autofix |
| `bun run format` | Format with oxfmt |
| `bun run typecheck` | TypeScript across all workspaces |
| `bun run knip` | Detect unused files, exports, and dependencies |
| `bun run story` | Histoire component workshop |
| `bun run story:build` | Build the static component workshop |
| `bun run db:push` | Push schema changes to the database |
| `bun run db:studio` | Drizzle Studio |
| `bun run content:import` | Import exercises from markdown into the DB |
| `bun run content:generate` | Generate a new exercise with an LLM |
| `bun run runners:build` | Build all sandbox runner images |

### Component workshop (Histoire)

`bun run story` opens an isolated workshop at <http://localhost:6006> for the
presentational components (`*.story.vue`). Histoire runs its own Vite server and
does **not** boot Nuxt, so stories must avoid Nuxt auto-imports; `NuxtLink` is
stubbed in `apps/web/histoire.setup.ts`.

> Histoire 1.0.0-beta.1 declares a `vite ^7` peer while Nuxt 4 ships Vite 8.
> It works, but `@vitejs/plugin-vue`, Tailwind, and the `~`/`@` aliases are
> registered explicitly in `histoire.config.ts` to compensate.

### Testing

Unit tests run on Vitest in every workspace:

```bash
bun run test                          # everything
bun run test --filter=@blankcode/api  # one workspace
cd apps/web && bun run test:watch     # watch mode
```

There is no Playwright suite in this repo — end-to-end coverage lives in the
external `cairntrace` engine.

## Architecture

### Backend (Effect.ts)

The API is built with `@effect/platform` (`HttpApiBuilder`) on Node's HTTP server:

- **Auth**: JWT access tokens + rotating refresh tokens, bcrypt password hashing
- **Tracks / Concepts / Exercises**: hierarchical learning content
- **Submissions**: queued for async execution via a worker process
- **Progress / Mastery / Reviews**: completion tracking + SM-2 spaced repetition
- **Achievements / Paths / Challenges**: gamification layer
- `@effect/cluster` is wired for workflow execution; the current production path is the SQL-polling worker in `apps/api/src/workers/`

### Frontend (Nuxt 4)

- **Pinia** for state management
- **Nuxt Content** for static markdown tutorials
- **Radix Vue** for accessible primitives
- **TailwindCSS v4** for styling
- **CodeMirror 6** for the editor (with blank-region widgets)

### Code Execution

Submissions are processed asynchronously by a dedicated worker process:

1. User submits code via the API; a row is inserted with `status='pending'`
2. The worker polls Postgres for pending rows and dispatches by language
3. Code runs in a hardened Docker sandbox (network=none, read-only fs, dropped caps, pid/memory/cpu/file limits)
4. Test output is parsed per language and stored back on the submission row
5. Progress, mastery, and the SM-2 review schedule are updated from the result

There is no Redis or external queue — Postgres is the only datastore.

## AI Exercise Generation

`bun run content:generate` authors new exercises with an LLM. Everything runs
through the **Vercel AI Gateway** via the AI SDK, so there is exactly one
credential and swapping models is a config edit, not a code change.

```bash
# .env — the only credential needed
AI_GATEWAY_API_KEY=vck_...

bun run content:generate --models                                   # list model slugs
bun run content:generate typescript generics advanced "conditional types"
bun run content:generate --init react --name "React"
bun run content:generate vue composition-api beginner --dry-run
```

The CLI prints the active model before each call.

### Model configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `AI_GATEWAY_API_KEY` | — | Vercel AI Gateway key ([docs](https://vercel.com/docs/ai-gateway)) |
| `LLM_MODEL` | `deepseek/deepseek-v4-flash` | Any gateway slug — see `--models` |
| `LLM_FALLBACK_MODELS` | — | Comma-separated failover chain |
| `LLM_TEMPERATURE` | `0.6` | Enough variety that exercise 002 differs from 001 |
| `LLM_MAX_TOKENS` | `4000` | |
| `LLM_MAX_RETRIES` | `2` | Transient failures are retried by the AI SDK |

Model slugs are `provider/model` and use **dots** for versions
(`anthropic/claude-sonnet-4.6`, not `-4-6`). DeepSeek is the default because it
is roughly 20-50x cheaper than frontier models for this workload; switching to
Anthropic is a one-line env change:

```bash
LLM_MODEL=anthropic/claude-sonnet-5
LLM_FALLBACK_MODELS=deepseek/deepseek-v4-pro
```

`VERCEL_OIDC_TOKEN` (from `vercel env pull`) is accepted as an alternative
credential. With neither set, the generator emits a placeholder exercise instead
of failing, so the pipeline stays testable with no credentials.

Requests are tagged `app:blankcode` / `feature:exercise-generation`, so
generation spend is attributable in the Vercel AI Gateway dashboard. Generated
output is validated (frontmatter, blank markers, `## Tests` section, code
blocks) and retried once with the failures fed back into the prompt.

## Content Authoring

Exercises are Markdown with YAML frontmatter:

```markdown
---
slug: hello-world
title: Hello World
description: Write your first program
difficulty: beginner
hints:
  - Use console.log() to print output
  - Strings should be wrapped in quotes
tags:
  - basics
  - output
---

Write a function that returns the string "Hello, World!".

\`\`\`typescript
export function hello(): string {
  return ___blank_start___"Hello, World!"___blank_end___;
}
\`\`\`

## Tests

\`\`\`typescript
import { expect, test } from 'vitest'

test('greets', () => {
  expect(hello()).toBe('Hello, World!')
})
\`\`\`
```

Place files in `content/tracks/{language}/{concept}/`, then run
`bun run content:import`. Adding a new track means adding a
`content/tracks/{slug}/` directory — and updating the language list in
`apps/web/components/landing/language-showcase.vue`, which links straight to
track slugs.

## API Reference

### Authentication

```bash
POST /auth/register   { "email", "username", "password" }
POST /auth/login      { "email", "password" }
POST /auth/refresh    { "refreshToken" }
```

### Exercises and submissions

```bash
GET  /exercises
GET  /exercises/:exerciseId
GET  /exercises/:exerciseId/progress
POST /submissions     { "exerciseId", "code" }
GET  /submissions/:id
```

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| General | 100 requests/minute |
| Auth | 5 requests/minute |
| Submissions | 30 requests/minute |

## Docker Deployment

```bash
docker compose up -d          # full stack
docker compose watch          # rebuild on change
bun run runners:build         # rebuild sandbox images only
```

The `runner-images` one-shot service builds every per-language sandbox image
before the worker starts. The worker fails fast at boot if an image is missing,
pointing at `docker compose up runner-images`.

| Service | Port | Description |
|---------|------|-------------|
| `web` | 3001 | Nuxt dev server |
| `api` | 3000 | Effect.ts API |
| `worker` | — | Submission processor (needs the Docker socket) |
| `postgres` | 5432 | PostgreSQL 17 |

## Toolchain notes

- **Bun** is the runtime and package manager — never npm/npx/yarn/pnpm.
- **TypeScript 7** everywhere except `apps/web`, which is pinned to 5.9.3
  because `vue-tsc` cannot yet resolve TS 7's package exports.
- TS 7 removed `baseUrl`; all `paths` in `tsconfig.base.json` are relative, and
  workspaces that need Node/Bun globals declare `"types"` explicitly.
- **oxlint** for linting and **oxfmt** for formatting (both Rust, from the oxc
  project), **Knip** for dead code, **Lefthook** for hooks (pre-commit: format +
  lint + typecheck + knip; pre-push: tests).
- oxfmt is scoped to JS/TS/Vue/JSON. Markdown and YAML are **excluded on
  purpose**: it reformats fenced code blocks, which would destroy the aligned
  comments in `content/tutorials/`.
- oxfmt 0.62 can reflow a multi-statement inline Vue handler
  (`@click="a(); b = false"`) into semicolon-less lines that Vue's template
  parser rejects — and `vue-tsc` does **not** catch it. Use a named handler
  instead; `apps/web/__tests__/sfc-compiles.test.ts` compiles every SFC to
  catch any recurrence.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `bun run verify`
4. Commit with a conventional-commit message

See [AGENTS.md](./AGENTS.md) for AI-assisted development guidelines.

## License

MIT — see [LICENSE](LICENSE).
