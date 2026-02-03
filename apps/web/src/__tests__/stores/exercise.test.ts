import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api'
import { useExerciseStore } from '@/stores/exercise'

vi.mock('@/api')

describe('useExerciseStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mockExercise = {
    id: 'ex-1',
    slug: 'test-exercise',
    title: 'Test Exercise',
    description: 'A test exercise',
    difficulty: 'beginner' as const,
    starterCode: 'const x = ___',
    solutionCode: 'const x = 42',
    testCode: 'expect(x).toBe(42)',
    hints: ['Hint 1'],
    order: 1,
    isPublished: true,
    conceptId: 'concept-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockSubmission = {
    id: 'sub-1',
    exerciseId: 'ex-1',
    userId: 'user-1',
    code: 'const x = 42',
    status: 'passed' as const,
    testResults: [{ name: 'test', passed: true, message: null, duration: 10 }],
    errorMessage: null,
    executionTimeMs: 100,
    createdAt: new Date(),
  }

  describe('initial state', () => {
    it('starts with null exercise', () => {
      const store = useExerciseStore()
      expect(store.exercise).toBeNull()
    })

    it('starts with empty submissions', () => {
      const store = useExerciseStore()
      expect(store.submissions).toEqual([])
    })

    it('starts with empty currentCode', () => {
      const store = useExerciseStore()
      expect(store.currentCode).toBe('')
    })

    it('hasPassedSubmission is false initially', () => {
      const store = useExerciseStore()
      expect(store.hasPassedSubmission).toBe(false)
    })
  })

  describe('loadExercise', () => {
    it('loads exercise and sets starter code', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      expect(store.exercise).toEqual(mockExercise)
      expect(store.currentCode).toBe(mockExercise.starterCode)
    })

    it('loads submissions for the exercise', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([mockSubmission])

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      expect(store.submissions).toHaveLength(1)
      expect(store.latestSubmission).toEqual(mockSubmission)
    })
  })

  describe('submitCode', () => {
    it('creates submission and updates state', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create).mockResolvedValue(mockSubmission)

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      const result = await store.submitCode('const x = 42')

      expect(result).toEqual(mockSubmission)
      expect(store.latestSubmission).toEqual(mockSubmission)
      expect(store.submissions).toContain(mockSubmission)
    })

    it('sets isSubmitting during submission', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSubmission), 100))
      )

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      const promise = store.submitCode('const x = 42')
      expect(store.isSubmitting).toBe(true)

      await promise
      expect(store.isSubmitting).toBe(false)
    })

    it('does nothing if no exercise loaded', async () => {
      const store = useExerciseStore()
      const result = await store.submitCode('code')
      expect(result).toBeUndefined()
    })
  })

  describe('hasPassedSubmission', () => {
    it('returns true when a passed submission exists', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([mockSubmission])

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      expect(store.hasPassedSubmission).toBe(true)
    })

    it('returns false when no passed submission', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([
        { ...mockSubmission, status: 'failed' as const },
      ])

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      expect(store.hasPassedSubmission).toBe(false)
    })
  })

  describe('updateCode', () => {
    it('updates currentCode', () => {
      const store = useExerciseStore()
      store.updateCode('new code')
      expect(store.currentCode).toBe('new code')
    })
  })

  describe('reset', () => {
    it('resets all state', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([mockSubmission])

      const store = useExerciseStore()
      await store.loadExercise('ex-1')
      store.reset()

      expect(store.exercise).toBeNull()
      expect(store.submissions).toEqual([])
      expect(store.currentCode).toBe('')
      expect(store.latestSubmission).toBeNull()
    })
  })
})
