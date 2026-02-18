import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestError, InvalidTransitionError, NotFoundError } from '../api/errors.js'
import {
  SubmissionsService,
  SubmissionsServiceLive,
} from '../modules/submissions/submissions.service.js'

function createMockDb() {
  const returningFn = vi.fn()
  // Drizzle query builders are thenable, so where() must return an object
  // that can be awaited (for retry) AND has .returning() (for updateStatus).
  const whereFn = vi.fn(() => {
    const result = Promise.resolve(undefined) as any
    result.returning = returningFn
    return result
  })
  const setFn = vi.fn(() => ({ where: whereFn }))
  const valuesFn = vi.fn(() => ({ returning: returningFn }))
  const deleteWhereFn = vi.fn()

  return {
    query: {
      exercises: {
        findFirst: vi.fn(),
      },
      submissions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(() => ({ values: valuesFn })),
    update: vi.fn(() => ({ set: setFn })),
    delete: vi.fn(() => ({ where: deleteWhereFn })),
    transaction: vi.fn(),
    // Expose inner mocks for assertions and per-test overrides
    _mocks: {
      returningFn,
      whereFn,
      setFn,
      valuesFn,
      deleteWhereFn,
    },
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  return SubmissionsServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as any)))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, SubmissionsService>,
  layer: Layer.Layer<SubmissionsService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('SubmissionsService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<SubmissionsService>

  const mockExercise = {
    id: 'exercise-1',
    slug: 'hello-world',
    name: 'Hello World',
    isPublished: true,
    conceptId: 'concept-1',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockSubmission = {
    id: 'sub-1',
    userId: 'user-1',
    exerciseId: 'exercise-1',
    code: 'console.log("hello")',
    status: 'pending',
    testResults: null,
    executionTimeMs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
  })

  describe('create', () => {
    const createInput = {
      exerciseId: 'exercise-1',
      code: 'console.log("hello")',
    }

    it('creates submission via insert returning', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(mockExercise)

      const createdSubmission = { ...mockSubmission, id: 'sub-new' }
      mockDb._mocks.returningFn.mockResolvedValue([createdSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.create('user-1', createInput)
        }),
        testLayer
      )

      expect(result.id).toBe('sub-new')
      expect(result.code).toBe('console.log("hello")')
      expect(mockDb.query.exercises.findFirst).toHaveBeenCalled()
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('fails with NotFoundError if exercise not found', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.create('user-1', createInput)
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('fails with NotFoundError if exercise is not published', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue({
        ...mockExercise,
        isPublished: false,
      })

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.create('user-1', createInput)
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('fails with BadRequestError if insert fails', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(mockExercise)
      mockDb._mocks.returningFn.mockRejectedValue(new Error('DB error'))

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.create('user-1', createInput)
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(BadRequestError)
    })
  })

  describe('findById', () => {
    it('returns submission with userId filter', async () => {
      const submissionWithExercise = { ...mockSubmission, exercise: mockExercise }
      mockDb.query.submissions.findFirst.mockResolvedValue(submissionWithExercise)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findById('sub-1', 'user-1')
        }),
        testLayer
      )

      expect(result.id).toBe('sub-1')
      expect(result.exercise).toBeDefined()
      expect(mockDb.query.submissions.findFirst).toHaveBeenCalled()
    })

    it('returns submission without userId filter', async () => {
      const submissionWithExercise = { ...mockSubmission, exercise: mockExercise }
      mockDb.query.submissions.findFirst.mockResolvedValue(submissionWithExercise)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findById('sub-1')
        }),
        testLayer
      )

      expect(result.id).toBe('sub-1')
      expect(mockDb.query.submissions.findFirst).toHaveBeenCalled()
    })

    it('throws NotFoundError when submission not found', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.findById('nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('findByExercise', () => {
    it('returns submissions for exercise and user', async () => {
      const submissionsList = [mockSubmission, { ...mockSubmission, id: 'sub-2', status: 'passed' }]
      mockDb.query.submissions.findMany.mockResolvedValue(submissionsList)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findByExercise('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe('sub-1')
      expect(result[1]?.id).toBe('sub-2')
      expect(mockDb.query.submissions.findMany).toHaveBeenCalled()
    })

    it('returns empty array when no submissions exist', async () => {
      mockDb.query.submissions.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findByExercise('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(0)
    })
  })

  describe('findByUser', () => {
    it('returns submissions with default pagination', async () => {
      const submissionsList = [{ ...mockSubmission, exercise: mockExercise }]
      mockDb.query.submissions.findMany.mockResolvedValue(submissionsList)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findByUser('user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(1)
      expect(result[0]?.exercise).toBeDefined()
      expect(mockDb.query.submissions.findMany).toHaveBeenCalled()
    })

    it('returns submissions with custom limit and offset', async () => {
      mockDb.query.submissions.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findByUser('user-1', 5, 10)
        }),
        testLayer
      )

      expect(result).toHaveLength(0)
      expect(mockDb.query.submissions.findMany).toHaveBeenCalled()
    })

    it('returns multiple submissions ordered by createdAt', async () => {
      const submissionsList = [
        { ...mockSubmission, id: 'sub-3', exercise: mockExercise },
        { ...mockSubmission, id: 'sub-2', exercise: mockExercise },
        { ...mockSubmission, id: 'sub-1', exercise: mockExercise },
      ]
      mockDb.query.submissions.findMany.mockResolvedValue(submissionsList)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.findByUser('user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(3)
      expect(result[0]?.id).toBe('sub-3')
    })
  })

  describe('retry', () => {
    it('resets failed submission to pending', async () => {
      const failedSubmission = {
        ...mockSubmission,
        status: 'failed',
        exercise: mockExercise,
      }
      mockDb.query.submissions.findFirst.mockResolvedValue(failedSubmission)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.retry('sub-1', 'user-1')
        }),
        testLayer
      )

      expect(result.status).toBe('pending')
      expect(result.id).toBe('sub-1')
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('resets errored submission to pending', async () => {
      const erroredSubmission = {
        ...mockSubmission,
        status: 'error',
        exercise: mockExercise,
      }
      mockDb.query.submissions.findFirst.mockResolvedValue(erroredSubmission)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.retry('sub-1', 'user-1')
        }),
        testLayer
      )

      expect(result.status).toBe('pending')
    })

    it('fails with NotFoundError when submission not found', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.retry('nonexistent', 'user-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('fails with BadRequestError when status is pending', async () => {
      const pendingSubmission = {
        ...mockSubmission,
        status: 'pending',
        exercise: mockExercise,
      }
      mockDb.query.submissions.findFirst.mockResolvedValue(pendingSubmission)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.retry('sub-1', 'user-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(BadRequestError)
    })

    it('fails with BadRequestError when status is running', async () => {
      const runningSubmission = {
        ...mockSubmission,
        status: 'running',
        exercise: mockExercise,
      }
      mockDb.query.submissions.findFirst.mockResolvedValue(runningSubmission)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.retry('sub-1', 'user-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(BadRequestError)
    })

    it('fails with BadRequestError when status is passed', async () => {
      const passedSubmission = {
        ...mockSubmission,
        status: 'passed',
        exercise: mockExercise,
      }
      mockDb.query.submissions.findFirst.mockResolvedValue(passedSubmission)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.retry('sub-1', 'user-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(BadRequestError)
    })
  })

  describe('updateStatus', () => {
    it('performs valid transition from pending to running', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'pending' })

      const updatedSubmission = { ...mockSubmission, status: 'running' }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'running')
        }),
        testLayer
      )

      expect(result.status).toBe('running')
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('performs valid transition from pending to error', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'pending' })

      const updatedSubmission = { ...mockSubmission, status: 'error' }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'error')
        }),
        testLayer
      )

      expect(result.status).toBe('error')
    })

    it('performs valid transition from running to passed', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'running' })

      const testResults = [{ name: 'test 1', passed: true, message: null, duration: 100 }]
      const updatedSubmission = {
        ...mockSubmission,
        status: 'passed',
        testResults,
        executionTimeMs: 150,
      }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'passed', testResults, 150)
        }),
        testLayer
      )

      expect(result.status).toBe('passed')
      expect(result.testResults).toEqual(testResults)
      expect(result.executionTimeMs).toBe(150)
    })

    it('performs valid transition from running to failed', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'running' })

      const testResults = [
        { name: 'test 1', passed: false, message: 'Expected 2 but got 3', duration: 50 },
      ]
      const updatedSubmission = {
        ...mockSubmission,
        status: 'failed',
        testResults,
        executionTimeMs: 80,
      }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'failed', testResults, 80)
        }),
        testLayer
      )

      expect(result.status).toBe('failed')
      expect(result.testResults).toHaveLength(1)
      expect(result.testResults[0].passed).toBe(false)
    })

    it('performs valid transition from running to error', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'running' })

      const updatedSubmission = { ...mockSubmission, status: 'error' }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'error')
        }),
        testLayer
      )

      expect(result.status).toBe('error')
    })

    it('fails with InvalidTransitionError for pending to passed', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'pending' })

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.updateStatus('sub-1', 'passed')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(InvalidTransitionError)
    })

    it('fails with InvalidTransitionError for pending to failed', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'pending' })

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.updateStatus('sub-1', 'failed')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(InvalidTransitionError)
    })

    it('returns updated submission with test results and execution time', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'running' })

      const testResults = [
        { name: 'adds numbers', passed: true, message: null, duration: 12 },
        { name: 'handles negatives', passed: true, message: null, duration: 8 },
      ]
      const updatedSubmission = {
        ...mockSubmission,
        status: 'passed',
        testResults,
        executionTimeMs: 250,
      }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'passed', testResults, 250)
        }),
        testLayer
      )

      expect(result.status).toBe('passed')
      expect(result.testResults).toHaveLength(2)
      expect(result.executionTimeMs).toBe(250)
    })

    it('allows transition when existing submission has no defined transitions (terminal state)', async () => {
      // 'passed' has no entry in VALID_TRANSITIONS, so the guard is skipped
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'passed' })

      const updatedSubmission = { ...mockSubmission, status: 'error' }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'error')
        }),
        testLayer
      )

      expect(result.status).toBe('error')
    })

    it('passes errorMessage to the update when provided', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'running' })

      const updatedSubmission = {
        ...mockSubmission,
        status: 'error',
        errorMessage: 'Sandbox crashed',
      }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'error', undefined, undefined, 'Sandbox crashed')
        }),
        testLayer
      )

      expect(result.status).toBe('error')
      // Verify set() was called with errorMessage
      expect(mockDb._mocks.setFn).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage: 'Sandbox crashed' })
      )
    })

    it('sets updatedAt on every status update', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue({ status: 'pending' })

      const updatedSubmission = { ...mockSubmission, status: 'running' }
      mockDb._mocks.returningFn.mockResolvedValue([updatedSubmission])

      await runService(
        Effect.gen(function* () {
          const svc = yield* SubmissionsService
          return yield* svc.updateStatus('sub-1', 'running')
        }),
        testLayer
      )

      expect(mockDb._mocks.setFn).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: expect.any(Date) })
      )
    })

    it('throws NotFoundError when submission does not exist', async () => {
      mockDb.query.submissions.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* SubmissionsService
            return yield* svc.updateStatus('nonexistent', 'running')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
