# AGENTS.md

Guidelines for AI agents (Claude, GPT, Copilot, etc.) working on the BlankCode codebase.

## Project Overview

BlankCode is a monorepo coding exercise platform built with:

- **Frontend**: Nuxt 4 (Vue 3 + Composition API), Pinia, TailwindCSS v4, CodeMirror 6, Radix Vue
- **Backend**: Effect.ts (`@effect/platform` HttpApiBuilder), PostgreSQL, Drizzle ORM
- **Workflows**: `@effect/cluster` (wired but currently unused — execution path is a SQL-polling worker in `apps/api/src/workers/`)
- **Sandboxing**: Docker per-language runner images (`docker/runners/Dockerfile.{typescript,python,go,rust,react}`) with hardened flags
- **Testing**: Vitest unit tests in every workspace. There is **no Playwright suite** — end-to-end coverage lives in the external `cairntrace` engine, so do not add one.
- **Component workshop**: Histoire (`bun run story`), stories are `*.story.vue`
- **AI generation**: Vercel AI SDK (`ai@7`) through the AI Gateway — one credential (`AI_GATEWAY_API_KEY`), model chosen by `LLM_MODEL` slug (`tools/exercise-generator/src/llm.ts`). Never add a direct provider SDK or raw `fetch` to an LLM API.
- **Tooling**: Turbo, Bun, oxlint + oxfmt (oxc), Knip, Lefthook
- **Runtime/Package Manager**: Bun (`bun`/`bunx`) — never npm/npx/yarn/pnpm

### TypeScript versions (read before touching tsconfig)

- Everything runs **TypeScript 7** except `apps/web`, pinned to **5.9.3**
  because `vue-tsc` cannot resolve TS 7's package exports yet.
- TS 7 **removed `baseUrl`**. All `paths` entries are relative to the config
  that declares them (`./packages/...` in `tsconfig.base.json`).
- TS 7 no longer auto-discovers `@types`. Workspaces needing Node or Bun
  globals declare them explicitly: `"types": ["node"]` / `"types": ["bun"]`.

## Critical Rules

### 1. Plan Before You Code

**Before writing any code, describe your approach and wait for approval.** Always ask clarifying questions if requirements are ambiguous. Don't assume - ask.

Questions to consider:
- What exactly should this feature do?
- What are the edge cases?
- How should errors be handled?
- What existing code will this interact with?

### 2. Keep Changes Small and Focused

**If a task requires changes to more than 3 files, stop and break it into smaller tasks first.**

Large changes are:
- Harder to review
- More likely to introduce bugs
- Difficult to roll back

Break work into logical, independently testable chunks.

### 3. Always Verify Your Work with Tests

**This is non-negotiable.** Before considering any task complete:

```bash
bun run verify   # lint + typecheck + test + knip
```

All four checks must pass before committing changes. Run them individually
(`bun run test`, `bun run typecheck`, `bun run lint`, `bun run knip`) while
iterating.

### 4. Write Tests for New Code

When adding new functionality:

- **API endpoints and services**: `apps/api/src/__tests__/`
- **Vue components, composables, stores, utils**: `apps/web/__tests__/`
- **Shared packages / tools**: `src/__tests__/` in that workspace
- **Visual review of a component**: add a `*.story.vue` next to it and check it in `bun run story`

**After writing code, list what could break and suggest tests to cover it.**

Example API service test:

```typescript
// apps/api/src/__tests__/my-service.test.ts
import { Effect, Layer } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { MyService, MyServiceLive } from '../modules/my/my.service.js'
import { Drizzle } from '../db.js'

const mockDb = {
  query: { things: { findFirst: vi.fn().mockResolvedValue({ id: '1' }) } },
}

it('returns the thing', async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* MyService
      return yield* service.doSomething('1')
    }).pipe(Effect.provide(MyServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as never)))))
  )
  expect(result.id).toBe('1')
})
```

Example web test — `apps/web/vitest.config.ts` registers `@vitejs/plugin-vue`
and the `~` alias, and runs on `happy-dom`:

```typescript
// apps/web/__tests__/my-component.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MyComponent from '~/components/ui/my-component.vue'

it('renders the label', () => {
  expect(mount(MyComponent, { props: { label: 'Hi' } }).text()).toContain('Hi')
})
```

Tests that need Nuxt auto-imports (`useRuntimeConfig`, `useApi`, `useCookie`)
do not work under plain Vitest — extract the logic into a pure function and
test that instead.

### 5. Fix Bugs with Test-Driven Development

**When there's a bug, start by writing a test that reproduces it, then fix it until the test passes.**

1. Write a failing test that demonstrates the bug
2. Verify the test fails for the right reason
3. Fix the code
4. Verify the test passes
5. Run all tests to ensure no regressions

This ensures the bug is truly fixed and won't reappear.

### 6. Run Tests Before Committing

The repository has pre-commit and pre-push hooks via Lefthook:

- **Pre-commit**: Runs lint, knip, and typecheck
- **Pre-push**: Runs all tests

If hooks fail, fix the issues before forcing a commit.

### 7. Learn and Document Mistakes

**Every time you are corrected, add a new rule to this AGENTS.md file so the mistake never happens again** (unless a similar rule already exists).

This file is a living document. When you learn something new about this codebase - a gotcha, a pattern, a requirement - add it here.

### 8. Verify Docker Compose CLI Flags

Before suggesting Docker Compose commands with flags (e.g., `--profile`), verify the supported CLI syntax for the installed Compose version by checking `docker compose --help` or running a quick local command.

## Project Structure

```
blankcode/
├── apps/
│   ├── api/                 # Effect.ts backend
│   │   ├── src/
│   │   │   ├── api/         # HttpApi endpoint definitions
│   │   │   ├── handlers/    # HttpApiBuilder handlers
│   │   │   ├── modules/     # Services (auth, exercises, progress, ...)
│   │   │   ├── middleware/  # Auth, admin, rate limiting
│   │   │   ├── services/    # Execution engine + per-language executors
│   │   │   ├── workflows/   # @effect/workflow definitions (mostly unused)
│   │   │   ├── workers/     # SQL-polling submission worker (the live path)
│   │   │   └── __tests__/   # Vitest unit tests
│   └── web/                 # Nuxt 4 frontend (flat layout, no src/)
│       ├── components/      # Vue components + *.story.vue
│       ├── pages/           # File-based routes
│       ├── stores/          # Pinia stores
│       ├── composables/     # Vue composables
│       ├── utils/           # Pure helpers
│       └── __tests__/       # Vitest unit tests
├── packages/
│   ├── db/                  # Drizzle schema and migrations
│   ├── shared/              # Shared types and utilities
│   └── exercise-parser/     # Markdown exercise parser
├── tools/
│   ├── content-importer/    # markdown -> database
│   └── exercise-generator/  # LLM-generated exercises (src/llm.ts)
├── content/                 # Exercise + tutorial markdown
└── docker/runners/          # Per-language sandbox images
```

Adding a language track means creating `content/tracks/{slug}/` **and** adding
it to `apps/web/components/landing/language-showcase.vue` — that component
links directly to track slugs, so a missing directory becomes a dead link.

## Exercise Authoring Rules

A corpus audit found that most of the content violates at least one of these,
in ways that silently produce broken or unverifiable exercises. Every rule here
exists because something in `content/tracks/` is currently wrong.

1. **A blank must never contain a newline.** Blanks render as a single-line
   `<input>`, so a multi-line answer cannot be typed and its feedback is
   permanently "incorrect".
2. **A blank's answer must never start or end with `_`.** Markers are
   underscore-delimited, so a dunder merges with the marker: `py-obj-001` parses
   to `def __init_(self)` — a canonical solution that fails its own tests.
   Widen the blank to include non-underscore text at both boundaries.
3. **No whitespace padding inside markers.** `___blank_start___x___blank_end___`,
   never `___blank_start___ x ___blank_end___` — the solution is trimmed but the
   span is not, so offsets drift.
4. **Blank boundaries must be token-balanced.** Never split a paren, bracket, or
   quote pair across a blank edge.
5. **The answer must be the only reasonable string.** Per-blank feedback is an
   exact trimmed compare, so quote style, variable naming, and optional
   arguments all produce false negatives. If an equivalent answer exists,
   restructure or do not blank it.
6. **Every blank must be observable by the tests.** TypeScript type annotations
   are erased before vitest runs; the TS executor now typechecks
   (`__typecheck.ts` compiles solution + test as one module) precisely so type
   blanks are verifiable. Other languages have no such backstop — blank runtime
   behaviour there.
7. **Tests must exercise the student's code**, never re-implement it, and must
   pass against the canonical solution.
8. **The starter block must be the FIRST fenced block.** `parseExercise` takes
   the first one; 29 of 31 challenges put "## Example Usage" ahead of the
   skeleton, so the editor loads the usage sample instead of the starter.
9. **Slugs must be globally unique.** The importer upserts on
   `(conceptId, slug)`, so a duplicate silently overwrites its twin — six pairs
   currently collide and one of each is lost at import.
10. **Quote any YAML hint containing a colon**, or the frontmatter fails
    validation and the file is skipped entirely.
11. **Test imports may only reference `./solution`**, and only packages present
    in that language's runner image.
12. **Set `difficulty` deliberately.** 42 of 60 blank exercises say `beginner`,
    including whole concepts named "advanced-*".

## Design System

The UI is a **practice sheet**: engineering graph paper you make a mark on. The
metaphor is not decoration — it is the product (fill in the blank), so keep new
UI inside it rather than reaching for generic dashboard patterns.

- **Type**: `IBM Plex Mono` is the *display* face (`.display` — tight, lowercase,
  the product is code text). `IBM Plex Sans` is prose. `.eyebrow` is the small
  uppercase mono label used for section marginalia. Self-hosted via `@nuxt/fonts`.
- **Colour**: near-square corners (`--radius: 0.25rem`), cool blue-grey paper in
  light, ink in dark. `--signal` (burnt orange) is **the pencil mark** — it is
  reserved for blanks, focus rings, and the due-count badge. Do not use it for
  ordinary CTAs; the primary button is ink.
- **`--rule` / `--rule-strong`**: the grid lines. Prefer a 1px rule over a gap or
  a shadow when separating things.
- **`.sheet` / `.sheet-fade`**: the graph-paper substrate. Used only on the hero
  and the error page — it is a deliberate surface, not wallpaper.
- **`.blank-slot`**: a blank as it appears on paper. Reused for the wordmark and
  the error page's status code.
- **Focus is never invisible** — a global `:focus-visible` ring in `--signal`.
  Do not remove it.
- **Copy**: statements, not apologies. Errors say what happened and what to do.
  Empty states offer an action. No marketing voice — this is a self-hosted tool
  with one user, not a funnel.

Error pages: `apps/web/error.vue` renders every status from
`apps/web/utils/error-copy.ts`. Adding a new status to the API means adding it
there — `apps/web/__tests__/error-copy.test.ts` enforces the coverage list.

## Code Style Guidelines

### TypeScript

- Use explicit types; avoid `any` unless absolutely necessary
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`; never use `var`
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### Effect.ts Specifics

- Services are defined as `Context.Tag` and provided via `Layer.effect`
- Wire all layers in `apps/api/src/main.ts` — `Layer.mergeAll` for siblings, `Layer.provide` for dependencies
- Use `@effect/schema` (re-exported as `effect/Schema`) for validation; share schemas via `@blankcode/shared/schemas`
- Apply `AuthRateLimit` / `SubmissionRateLimit` middleware to public endpoints in `apps/api/src/api/`
- Map domain errors via `Effect.tryPromise({ try, catch: () => new SomeError(...) })`; never `catch: () => undefined` (silently swallows)

```typescript
// Define the service shape and tag
interface MyServiceShape {
  readonly doSomething: (id: string) => Effect.Effect<Result, NotFoundError>
}
export class MyService extends Context.Tag('MyService')<MyService, MyServiceShape>() {}

// Provide it
export const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const db = yield* Drizzle
    return MyService.of({
      doSomething: (id) =>
        Effect.tryPromise({
          try: () => db.query.things.findFirst({ where: eq(things.id, id) }),
          catch: () => new NotFoundError({ message: 'Thing not found' }),
        }),
    })
  })
)
```

### Vue Specifics

- Use `<script setup lang="ts">` syntax
- Use Pinia stores for shared state
- Prefer composables for reusable logic
- Use Radix Vue for accessible UI components

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useExerciseStore } from '@/stores/exercise'

const store = useExerciseStore()
const isLoading = computed(() => store.isSubmitting)
</script>
```

### Testing Patterns

**API Service Tests:**

`apps/api/test/setup.ts` already mocks `@blankcode/db` and sets a test
`JWT_SECRET` (the config module throws on a missing or default one). Mock the
Drizzle query builder shape the service actually uses:

```typescript
const mockDb = {
  query: { users: { findFirst: vi.fn().mockResolvedValue(mockUser) } },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([mockUser]),
    }),
  }),
}
```

See `apps/api/src/__tests__/auth.service.test.ts` for the full Layer wiring.

**Histoire Stories:**

Stories live next to the component as `*.story.vue`. Histoire runs its own Vite
server and does **not** boot Nuxt, so a story can only use props-driven,
presentational components. `NuxtLink` is stubbed in `histoire.setup.ts`; other
Nuxt auto-imports are unavailable.

```vue
<script setup lang="ts">
import MyComponent from './my-component.vue'
</script>

<template>
  <Story title="MyComponent" group="ui">
    <Variant title="Default"><MyComponent /></Variant>
    <Variant title="Loading"><MyComponent loading /></Variant>
  </Story>
</template>
```

## Common Pitfalls

### 1. oxfmt can emit non-compiling Vue templates

oxfmt 0.62 reflows a multi-statement inline handler
(`@click="a(); b = false"`) onto separate lines without semicolons, which Vue's
template parser rejects. `vue-tsc` does **not** catch this — only the build
does. Always extract multi-statement handlers into a named function.
`apps/web/__tests__/sfc-compiles.test.ts` compiles every SFC as a guard.

**oxfmt scope**: JS/TS/Vue/JSON only. `.md` and `.yml` are excluded in
`.oxfmtrc.json` because oxfmt reformats fenced code blocks and would destroy the
deliberately aligned comments in `content/tutorials/`.

**oxlint on Vue**: unused-variable rules are off for `.vue` (the linter cannot
see template usage). Console rules are off in `tools/**` and the worker.

### 2. Turbo cache and test inputs

`turbo.json` lists explicit `inputs` for the `test` task. If you add tests in a
new directory, add that directory to `inputs` — otherwise Turbo replays a stale
cached pass and your new tests never run.

### 3. Vue Test Utils Selectors

Be specific with CSS selectors in tests. `div > div` may not select what you expect:

```typescript
// May select wrong element
wrapper.find('div > div')

// More specific and reliable
wrapper.find('.my-class > div')
wrapper.find('[data-testid="my-element"]')
```

### 4. Async Test Patterns

Always await async operations in tests:

```typescript
// Wrong
it('loads data', () => {
  store.loadData()
  expect(store.data).toBeDefined() // May fail - not awaited
})

// Correct
it('loads data', async () => {
  await store.loadData()
  expect(store.data).toBeDefined()
})
```

## Database Changes

When modifying the database schema:

1. Edit schema in `packages/db/src/schema/`
2. Run `bun run db:push` to apply changes
3. If needed, generate migration with `bun run db:generate`
4. Update related Zod schemas in `packages/shared/`

## Adding New Features

### New API Endpoint

1. Declare the endpoint in `apps/api/src/api/*.api.ts` (Effect `HttpApiGroup`)
2. Share request/response schemas via `@blankcode/shared/schemas`
3. Implement the service in `apps/api/src/modules/`
4. Wire the handler in `apps/api/src/handlers/*.handlers.ts`
5. Provide the layer in `apps/api/src/main.ts`
6. Apply `AuthRateLimit` / `SubmissionRateLimit` if the endpoint is public
7. **Write tests for the service** in `apps/api/src/__tests__/`
8. Add the client method to `apps/web/composables/useApi.ts`

### New Vue Component

1. Create the component in `apps/web/components/{group}/`
2. Use `<script setup lang="ts">` and TailwindCSS
3. Add a `*.story.vue` beside it if it is presentational
4. **Write tests in `apps/web/__tests__/`**
5. Run `bun run test` and eyeball it with `bun run story`

### New Pinia Store

1. Create the store in `apps/web/stores/`
2. Use the setup-function pattern (see `stores/exercise.ts`)
3. Keep pure logic in `utils/` or `composables/` so it is testable without Nuxt
4. **Write tests in `apps/web/__tests__/`** for the extracted logic

## Commit Guidelines

Use conventional commits:

```
feat: add new exercise completion badge
fix: resolve race condition in submission handler
docs: update API documentation
test: add tests for auth service
refactor: simplify progress calculation logic
chore: update dependencies
```

Always include the co-author line:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Pre-Flight Checklist

Before starting work:

- [ ] Requirements are clear (asked clarifying questions if needed)
- [ ] Approach was described and approved
- [ ] Task touches 3 or fewer files (or was broken into smaller tasks)

Before marking any task as complete:

- [ ] Code compiles without errors: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] All tests pass: `bun run test`
- [ ] New code has test coverage
- [ ] Listed what could break and added tests for it
- [ ] No `console.log` statements left in code
- [ ] No `any` types without an `oxlint-disable-next-line` comment
- [ ] API endpoints have rate limiting if public
- [ ] Sensitive data is not exposed in responses

## Debugging Tips

### API Issues

```bash
# Check API logs
docker compose logs -f api

# Test endpoint manually
curl -X GET http://localhost:3000/health

# Check database connection
bun run db:studio
```

### Test Failures

```bash
# Run single test file
npx vitest run path/to/test.ts

# Run with verbose output
npx vitest run --reporter=verbose

# Debug specific test
npx vitest run -t "test name pattern"
```

### Build Issues

```bash
# Clear Turbo cache
rm -rf .turbo

# Clean and rebuild
bun run clean && bun install && bun run build
```

## Resources

- [Effect Documentation](https://effect.website/)
- [Nuxt 4 Documentation](https://nuxt.com/docs)
- [Vue 3 Documentation](https://vuejs.org/guide/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vitest Documentation](https://vitest.dev/)
- [Histoire Documentation](https://histoire.dev/)
- [oxlint Documentation](https://oxc.rs/docs/guide/usage/linter.html)
- [oxfmt Documentation](https://oxc.rs/docs/guide/usage/formatter.html)
- [DeepSeek API Documentation](https://api-docs.deepseek.com/)

## Getting Help

If you're stuck:

1. Check existing tests for patterns
2. Look at similar implementations in the codebase
3. Review the error message carefully
4. Check the documentation links above

---

## Summary: The Golden Rules

1. **Ask first, code later** - Clarify requirements before writing code
2. **Keep it small** - No more than 3 files per change
3. **Test everything** - Write tests, run tests, trust tests
4. **Bugs need tests** - Reproduce with a test, then fix
5. **Learn from mistakes** - Update this file when corrected

Remember: **Always run tests before committing. No exceptions.**
