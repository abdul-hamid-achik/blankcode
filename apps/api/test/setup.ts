import { vi } from 'vitest'

// Provide a non-default secret so the config module's hardening guard passes
// when test files import anything that pulls in `apps/api/src/config`.
process.env.JWT_SECRET ??= 'test-secret-not-for-production-use-only-in-vitest'

vi.mock('@blankcode/db', () => ({
  createDatabase: vi.fn(),
  createDatabaseFromEnv: vi.fn(),
}))
