import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewsService, ReviewsServiceLive } from '../modules/reviews/reviews.service.js'

function createMockDb() {
  return {
    query: {
      reviewSchedules: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      exercises: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockResolvedValue([{ id: 'schedule-1' }, { id: 'schedule-2' }, { id: 'schedule-3' }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation(() => Promise.resolve([{ id: 'schedule-1' }])),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  return ReviewsServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as any)))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, ReviewsService>,
  layer: Layer.Layer<ReviewsService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('ReviewsService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<ReviewsService>

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('scheduleReview', () => {
    it('should create a new schedule on first pass', async () => {
      mockDb.query.reviewSchedules.findFirst.mockResolvedValue(null)
      mockDb.insert.mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => Promise.resolve([{ id: 'schedule-1' }])),
      }))

      await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          yield* svc.scheduleReview('user-1', 'exercise-1', true)
        }),
        testLayer
      )

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should update existing schedule on subsequent pass', async () => {
      mockDb.query.reviewSchedules.findFirst.mockResolvedValue({
        id: 'schedule-1',
        userId: 'user-1',
        exerciseId: 'exercise-1',
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        nextReviewAt: new Date(),
        lastReviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          yield* svc.scheduleReview('user-1', 'exercise-1', true)
        }),
        testLayer
      )

      expect(mockDb.update).toHaveBeenCalled()
    })

    it('should reset schedule on failed attempt', async () => {
      mockDb.query.reviewSchedules.findFirst.mockResolvedValue({
        id: 'schedule-1',
        userId: 'user-1',
        exerciseId: 'exercise-1',
        intervalDays: 10,
        repetitions: 5,
        easeFactor: 2.5,
        nextReviewAt: new Date(),
        lastReviewedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          yield* svc.scheduleReview('user-1', 'exercise-1', false)
        }),
        testLayer
      )

      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('getDueReviews', () => {
    it('should return only exercises where nextReviewAt <= now()', async () => {
      const now = new Date()
      mockDb.query.reviewSchedules.findMany.mockResolvedValue([
        {
          id: 'schedule-1',
          userId: 'user-1',
          exerciseId: 'exercise-1',
          intervalDays: 1,
          repetitions: 1,
          easeFactor: 2.5,
          nextReviewAt: new Date(now.getTime() - 86400000), // yesterday
          lastReviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          exercise: {
            id: 'exercise-1',
            title: 'Test Exercise',
            slug: 'test',
            description: 'Test',
            difficulty: 'beginner',
            type: 'blank',
            starterCode: '',
            solutionCode: '',
            testCode: '',
            hints: [],
            blanks: [],
            order: 0,
            isPublished: true,
            conceptId: 'concept-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            concept: {
              id: 'concept-1',
              name: 'Test Concept',
              slug: 'test-concept',
              description: 'Test',
              order: 0,
              isPublished: true,
              trackId: 'track-1',
              createdAt: new Date(),
              updatedAt: new Date(),
              track: {
                id: 'track-1',
                name: 'Test Track',
                slug: 'test',
                description: 'Test',
                order: 0,
                isPublished: true,
                iconUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          return yield* svc.getDueReviews('user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(1)
      expect(result[0]?.title).toBe('Test Exercise')
      expect(result[0]?.schedule?.intervalDays).toBe(1)
    })
  })

  describe('getDueCount', () => {
    it('should return count of due reviews', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ id: 'schedule-1' }, { id: 'schedule-2' }, { id: 'schedule-3' }]),
        }),
      })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          return yield* svc.getDueCount('user-1')
        }),
        testLayer
      )

      expect(result).toBe(3)
    })

    it('should return 0 when no reviews are due', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          return yield* svc.getDueCount('user-1')
        }),
        testLayer
      )

      expect(result).toBe(0)
    })
  })

  describe('recordReview', () => {
    it('should behave like scheduleReview', async () => {
      mockDb.query.reviewSchedules.findFirst.mockResolvedValue(null)
      mockDb.insert.mockImplementation(() => ({
        values: vi.fn().mockImplementation(() => Promise.resolve([{ id: 'schedule-1' }])),
      }))

      await runService(
        Effect.gen(function* () {
          const svc = yield* ReviewsService
          yield* svc.recordReview('user-1', 'exercise-1', true)
        }),
        testLayer
      )

      expect(mockDb.insert).toHaveBeenCalled()
    })
  })
})
