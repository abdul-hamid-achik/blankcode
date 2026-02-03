# AGENTS.md

Guidelines for AI agents (Claude, GPT, Copilot, etc.) working on the BlankCode codebase.

## Project Overview

BlankCode is a monorepo coding exercise platform built with:

- **Frontend**: Vue 3, Vite, Pinia, TailwindCSS, CodeMirror
- **Backend**: NestJS with Fastify, PostgreSQL, Drizzle ORM
- **Queue**: BullMQ with Redis for async code execution
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Tooling**: Turbo, Bun, Biome, TypeScript

## Critical Rules

### 1. Always Verify Your Work with Tests

**This is non-negotiable.** Before considering any task complete:

```bash
# Run unit tests
bun run test

# Run type checking
bun run typecheck

# Run linting
bun run lint
```

All three commands must pass before committing changes.

### 2. Write Tests for New Code

When adding new functionality:

- **API endpoints**: Add tests in `apps/api/src/__tests__/`
- **Vue components**: Add tests in `apps/web/src/__tests__/components/`
- **Pinia stores**: Add tests in `apps/web/src/__tests__/stores/`
- **Utilities**: Add tests alongside the utility file or in `__tests__/`

Example test structure:

```typescript
// apps/api/src/__tests__/my-service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Test } from '@nestjs/testing'
import { MyService } from '../modules/my/my.service.js'

describe('MyService', () => {
  let service: MyService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MyService],
    }).compile()

    service = module.get<MyService>(MyService)
  })

  it('should do something', () => {
    expect(service.doSomething()).toBe(expected)
  })
})
```

### 3. Run Tests Before Committing

The repository has pre-commit and pre-push hooks via Lefthook:

- **Pre-commit**: Runs lint, knip, and typecheck
- **Pre-push**: Runs all tests

If hooks fail, fix the issues before forcing a commit.

## Project Structure

```
blankcode/
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/     # Feature modules (auth, exercises, etc.)
│   │   │   ├── common/      # Shared guards, decorators, filters
│   │   │   ├── database/    # Drizzle provider
│   │   │   ├── services/    # Execution services
│   │   │   └── workers/     # BullMQ workers
│   │   └── test/            # E2E tests
│   └── web/                 # Vue 3 frontend
│       ├── src/
│       │   ├── components/  # Vue components
│       │   ├── views/       # Page components
│       │   ├── stores/      # Pinia stores
│       │   ├── composables/ # Vue composables
│       │   └── api/         # API client
│       └── e2e/             # Playwright tests
├── packages/
│   ├── db/                  # Drizzle schema and migrations
│   ├── shared/              # Shared types and utilities
│   └── exercise-parser/     # Markdown exercise parser
└── tools/
    ├── content-importer/    # Import exercises from markdown
    └── exercise-generator/  # AI-powered exercise generation
```

## Code Style Guidelines

### TypeScript

- Use explicit types; avoid `any` unless absolutely necessary
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `const` over `let`; never use `var`
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### NestJS Specifics

- Use explicit `@Inject()` decorators for dependency injection
- All services should be `@Injectable()`
- Use Zod schemas from `@blankcode/shared` for validation
- Apply rate limiting decorators to public endpoints

```typescript
// Correct: Explicit @Inject for all dependencies
@Injectable()
export class MyService {
  constructor(
    @Inject(DRIZZLE) private db: Database,
    @Inject(JwtService) private jwtService: JwtService
  ) {}
}
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

```typescript
import { Test } from '@nestjs/testing'
import { JwtModule } from '@nestjs/jwt'
import { DRIZZLE } from '../database/drizzle.provider.js'

const mockDb = {
  query: { users: { findFirst: vi.fn() } },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([mockUser]),
    }),
  }),
}

const module = await Test.createTestingModule({
  imports: [JwtModule.register({ secret: 'test', signOptions: { expiresIn: '1d' } })],
  providers: [
    MyService,
    { provide: DRIZZLE, useValue: mockDb },
  ],
}).compile()
```

**Vue Component Tests:**

```typescript
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MyComponent from '@/components/MyComponent.vue'

beforeEach(() => {
  setActivePinia(createPinia())
})

it('renders correctly', () => {
  const wrapper = mount(MyComponent, {
    props: { title: 'Test' },
  })
  expect(wrapper.text()).toContain('Test')
})
```

**Pinia Store Tests:**

```typescript
import { createPinia, setActivePinia } from 'pinia'
import { useMyStore } from '@/stores/my'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

it('updates state correctly', async () => {
  const store = useMyStore()
  await store.loadData()
  expect(store.data).toBeDefined()
})
```

## Common Pitfalls

### 1. Biome Linting Issues

**Parameter decorators**: Biome requires `unsafeParameterDecoratorsEnabled: true` in the config.

**Constructor parameter properties**: Biome may report false positives for "unused" constructor parameters that are actually class properties. This rule is disabled in the config.

**Vue files**: Biome doesn't understand Vue template usage, so unused import/variable rules are disabled for `.vue` files.

### 2. NestJS Dependency Injection

In ESM environments with Vitest, NestJS requires explicit `@Inject()` decorators:

```typescript
// Won't work in tests
constructor(private jwtService: JwtService) {}

// Works correctly
constructor(@Inject(JwtService) private jwtService: JwtService) {}
```

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

1. Create or update module in `apps/api/src/modules/`
2. Add DTOs with Zod validation
3. Implement service logic
4. Add controller with proper decorators
5. **Write tests for the service**
6. Run `bun run test` to verify

### New Vue Component

1. Create component in `apps/web/src/components/`
2. Use TypeScript with `<script setup lang="ts">`
3. Apply TailwindCSS for styling
4. **Write tests in `__tests__/components/`**
5. Run `bun run test` to verify

### New Pinia Store

1. Create store in `apps/web/src/stores/`
2. Use the composition API pattern
3. Export typed actions and getters
4. **Write tests in `__tests__/stores/`**
5. Run `bun run test` to verify

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

Before marking any task as complete, verify:

- [ ] Code compiles without errors: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] All tests pass: `bun run test`
- [ ] New code has test coverage
- [ ] No `console.log` statements left in code
- [ ] No `any` types without `biome-ignore` comment
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

- [NestJS Documentation](https://docs.nestjs.com/)
- [Vue 3 Documentation](https://vuejs.org/guide/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vitest Documentation](https://vitest.dev/)
- [Biome Documentation](https://biomejs.dev/)

## Getting Help

If you're stuck:

1. Check existing tests for patterns
2. Look at similar implementations in the codebase
3. Review the error message carefully
4. Check the documentation links above

Remember: **Always run tests before committing. No exceptions.**
