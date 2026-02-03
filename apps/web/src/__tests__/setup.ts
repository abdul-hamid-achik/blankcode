import { vi } from 'vitest'

vi.mock('@/api', () => ({
  api: {
    auth: {
      login: vi.fn(),
      register: vi.fn(),
    },
    users: {
      getMe: vi.fn(),
    },
    tracks: {
      getAll: vi.fn(),
      getBySlug: vi.fn(),
    },
    exercises: {
      getByConcept: vi.fn(),
      getBySlug: vi.fn(),
      getById: vi.fn(),
    },
    submissions: {
      create: vi.fn(),
      getById: vi.fn(),
      getByExercise: vi.fn(),
      getMine: vi.fn(),
    },
  },
}))

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
})
