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
      expect(store.submissions).toContainEqual(mockSubmission)
    })

    it('sets isSubmitting during submission and keeps it true while polling', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create).mockResolvedValue(mockSubmission)

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      const promise = store.submitCode('const x = 42')
      expect(store.isSubmitting).toBe(true)

      await promise
      // isSubmitting stays true because polling is still running
      expect(store.isSubmitting).toBe(true)

      // Clean up polling
      store.stopPolling()
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
      expect(store.timedOut).toBe(false)
    })
  })

  describe('timedOut', () => {
    it('starts as false', () => {
      const store = useExerciseStore()
      expect(store.timedOut).toBe(false)
    })
  })

  describe('retrySubmission', () => {
    it('calls API retry and restarts polling', async () => {
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create).mockResolvedValue(mockSubmission)
      vi.mocked(api.submissions.retry).mockResolvedValue(mockSubmission)

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      await store.retrySubmission('sub-1')

      expect(api.submissions.retry).toHaveBeenCalledWith('sub-1')
      expect(store.timedOut).toBe(false)
    })
  })

  describe('submissionError', () => {
    it('sets submissionError on API failure', async () => {
      vi.mocked(api.exercises.getWithProgress).mockRejectedValue(new Error('fail'))
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create).mockRejectedValue(new Error('Network error'))

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      await store.submitCode('const x = 42')

      expect(store.submissionError).toBe('Network error')
      expect(store.isSubmitting).toBe(false)
    })

    it('clears submissionError on next submit attempt', async () => {
      vi.mocked(api.exercises.getWithProgress).mockRejectedValue(new Error('fail'))
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockSubmission)

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      await store.submitCode('const x = 42')
      expect(store.submissionError).toBe('Network error')

      await store.submitCode('const x = 42')
      expect(store.submissionError).toBeNull()

      store.stopPolling()
    })
  })

  describe('loadError', () => {
    it('sets loadError when both load attempts fail', async () => {
      vi.mocked(api.exercises.getWithProgress).mockRejectedValue(new Error('fail'))
      vi.mocked(api.exercises.getById).mockRejectedValue(new Error('Not found'))

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      expect(store.loadError).toBe('Not found')
      expect(store.exercise).toBeNull()
    })

    it('does not set loadError when fallback succeeds', async () => {
      vi.mocked(api.exercises.getWithProgress).mockRejectedValue(new Error('fail'))
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      expect(store.loadError).toBeNull()
      expect(store.exercise).toEqual(mockExercise)
    })
  })

  describe('double-submit guard', () => {
    it('ignores submit when already submitting', async () => {
      vi.mocked(api.exercises.getWithProgress).mockRejectedValue(new Error('fail'))
      vi.mocked(api.exercises.getById).mockResolvedValue(mockExercise)
      vi.mocked(api.submissions.getByExercise).mockResolvedValue([])
      vi.mocked(api.submissions.create).mockResolvedValue(mockSubmission)

      const store = useExerciseStore()
      await store.loadExercise('ex-1')

      // First submit
      const promise1 = store.submitCode('const x = 42')
      // Second submit while first is in progress
      const promise2 = store.submitCode('const x = 42')

      await Promise.all([promise1, promise2])

      expect(api.submissions.create).toHaveBeenCalledTimes(1)

      store.stopPolling()
    })
  })
})
