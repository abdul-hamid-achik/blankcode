import { vi } from 'vitest'

vi.mock('@blankcode/db', () => ({
  createDatabase: vi.fn(),
  createDatabaseFromEnv: vi.fn(),
}))
