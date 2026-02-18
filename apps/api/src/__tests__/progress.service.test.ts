import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressService, ProgressServiceLive } from '../modules/progress/progress.service.js'

function createMockDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue([])
  return {
    query: {
      submissions: { findMany: vi.fn() },
      userProgress: { findMany: vi.fn(), findFirst: vi.fn() },
      tracks: { findFirst: vi.fn(), findMany: vi.fn() },
      concepts: { findMany: vi.fn() },
      exercises: { findFirst: vi.fn(), findMany: vi.fn() },
      conceptMastery: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate,
      }),
    }),
    _onConflictDoUpdate: onConflictDoUpdate,
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  return ProgressServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as any)))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, ProgressService>,
  layer: Layer.Layer<ProgressService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('ProgressService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<ProgressService>

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getActivityTimeline', () => {
    it('returns 30 days of activity with counts', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-03T12:00:00Z'))

      mockDb.query.submissions.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-03T05:00:00Z') },
        { createdAt: new Date('2026-02-02T23:00:00Z') },
      ])
      mockDb.query.userProgress.findMany.mockResolvedValue([
        { completedAt: new Date('2026-02-03T03:00:00Z') },
        { completedAt: new Date('2026-01-25T10:00:00Z') },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getActivityTimeline('user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(30)
      expect(result[0]?.date).toBe('2026-01-05')
      expect(result[result.length - 1]?.date).toBe('2026-02-03')

      const feb3 = result.find((entry) => entry.date === '2026-02-03')
      const feb2 = result.find((entry) => entry.date === '2026-02-02')
      const jan25 = result.find((entry) => entry.date === '2026-01-25')

      expect(feb3).toEqual({ date: '2026-02-03', submissions: 1, exercisesCompleted: 1 })
      expect(feb2).toEqual({ date: '2026-02-02', submissions: 1, exercisesCompleted: 0 })
      expect(jan25).toEqual({ date: '2026-01-25', submissions: 0, exercisesCompleted: 1 })
    })
  })

  describe('getExerciseProgress', () => {
    it('returns progress for an exercise', async () => {
      const mockProgress = {
        userId: 'user-1',
        exerciseId: 'exercise-1',
        isCompleted: true,
        attempts: 3,
        completedAt: new Date(),
      }
      mockDb.query.userProgress.findFirst.mockResolvedValue(mockProgress)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getExerciseProgress('user-1', 'exercise-1')
        }),
        testLayer
      )

      expect(result).toEqual(mockProgress)
      expect(result.isCompleted).toBe(true)
      expect(result.attempts).toBe(3)
    })

    it('returns null when no progress exists', async () => {
      mockDb.query.userProgress.findFirst.mockResolvedValue(undefined)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getExerciseProgress('user-1', 'exercise-1')
        }),
        testLayer
      )

      expect(result).toBeNull()
    })
  })

  describe('getConceptMastery', () => {
    it('returns mastery for a concept', async () => {
      const mockMastery = {
        userId: 'user-1',
        conceptId: 'concept-1',
        masteryLevel: 0.75,
        exercisesCompleted: 3,
        exercisesTotal: 4,
        lastPracticedAt: new Date(),
      }
      mockDb.query.conceptMastery.findFirst.mockResolvedValue(mockMastery)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getConceptMastery('user-1', 'concept-1')
        }),
        testLayer
      )

      expect(result).toEqual(mockMastery)
      expect(result.masteryLevel).toBe(0.75)
    })

    it('returns null when no mastery exists', async () => {
      mockDb.query.conceptMastery.findFirst.mockResolvedValue(undefined)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getConceptMastery('user-1', 'concept-1')
        }),
        testLayer
      )

      expect(result).toBeNull()
    })
  })

  describe('getTrackProgress', () => {
    it('returns concept progress for a track', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue({
        id: 'track-1',
        slug: 'typescript',
        name: 'TypeScript',
      })
      mockDb.query.concepts.findMany.mockResolvedValue([
        {
          id: 'concept-1',
          slug: 'variables',
          name: 'Variables',
          exercises: [{ id: 'ex-1' }, { id: 'ex-2' }],
        },
        {
          id: 'concept-2',
          slug: 'functions',
          name: 'Functions',
          exercises: [{ id: 'ex-3' }],
        },
      ])
      mockDb.query.conceptMastery.findMany.mockResolvedValue([
        {
          conceptId: 'concept-1',
          masteryLevel: 0.5,
          exercisesCompleted: 1,
          exercisesTotal: 2,
        },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getTrackProgress('user-1', 'typescript')
        }),
        testLayer
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        conceptId: 'concept-1',
        conceptSlug: 'variables',
        conceptName: 'Variables',
        mastery: {
          conceptId: 'concept-1',
          masteryLevel: 0.5,
          exercisesCompleted: 1,
          exercisesTotal: 2,
        },
        totalExercises: 2,
      })
      expect(result[1]).toEqual({
        conceptId: 'concept-2',
        conceptSlug: 'functions',
        conceptName: 'Functions',
        mastery: null,
        totalExercises: 1,
      })
    })

    it('returns empty array for unknown track', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getTrackProgress('user-1', 'nonexistent')
        }),
        testLayer
      )

      expect(result).toEqual([])
    })
  })

  describe('getSummary', () => {
    it('returns per-track completion stats', async () => {
      mockDb.query.tracks.findMany.mockResolvedValue([
        {
          slug: 'typescript',
          name: 'TypeScript',
          concepts: [
            { exercises: [{ id: 'ex-1' }, { id: 'ex-2' }, { id: 'ex-3' }] },
            { exercises: [{ id: 'ex-4' }] },
          ],
        },
        {
          slug: 'rust',
          name: 'Rust',
          concepts: [{ exercises: [{ id: 'ex-5' }, { id: 'ex-6' }] }],
        },
      ])
      mockDb.query.userProgress.findMany.mockResolvedValue([
        { exerciseId: 'ex-1' },
        { exerciseId: 'ex-2' },
        { exerciseId: 'ex-5' },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getSummary('user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        trackSlug: 'typescript',
        trackName: 'TypeScript',
        totalExercises: 4,
        completedExercises: 2,
        masteryLevel: 0.5,
      })
      expect(result[1]).toEqual({
        trackSlug: 'rust',
        trackName: 'Rust',
        totalExercises: 2,
        completedExercises: 1,
        masteryLevel: 0.5,
      })
    })

    it('returns zero mastery for tracks with no exercises', async () => {
      mockDb.query.tracks.findMany.mockResolvedValue([
        {
          slug: 'empty',
          name: 'Empty Track',
          concepts: [],
        },
      ])
      mockDb.query.userProgress.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getSummary('user-1')
        }),
        testLayer
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        trackSlug: 'empty',
        trackName: 'Empty Track',
        totalExercises: 0,
        completedExercises: 0,
        masteryLevel: 0,
      })
    })
  })

  describe('getStats', () => {
    it('returns stats with streak calculation', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-03T12:00:00Z'))

      mockDb.query.userProgress.findMany.mockResolvedValue([
        { completedAt: new Date('2026-02-03T10:00:00Z') },
        { completedAt: new Date('2026-02-02T15:00:00Z') },
        { completedAt: new Date('2026-02-01T09:00:00Z') },
      ])
      mockDb.query.submissions.findMany.mockResolvedValue([
        { id: 'sub-1' },
        { id: 'sub-2' },
        { id: 'sub-3' },
        { id: 'sub-4' },
        { id: 'sub-5' },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getStats('user-1')
        }),
        testLayer
      )

      expect(result.totalExercisesCompleted).toBe(3)
      expect(result.totalSubmissions).toBe(5)
      expect(result.currentStreak).toBe(3)
      expect(result.longestStreak).toBe(3)
      expect(result.lastActivityDate).toBe(new Date('2026-02-03T10:00:00Z').toISOString())
    })

    it('returns longest streak longer than current streak', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-10T12:00:00Z'))

      mockDb.query.userProgress.findMany.mockResolvedValue([
        // Current streak: 1 day (today)
        { completedAt: new Date('2026-02-10T10:00:00Z') },
        // Gap on Feb 9
        // Old streak: 5 days (Feb 3-7)
        { completedAt: new Date('2026-02-07T10:00:00Z') },
        { completedAt: new Date('2026-02-06T10:00:00Z') },
        { completedAt: new Date('2026-02-05T10:00:00Z') },
        { completedAt: new Date('2026-02-04T10:00:00Z') },
        { completedAt: new Date('2026-02-03T10:00:00Z') },
      ])
      mockDb.query.submissions.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getStats('user-1')
        }),
        testLayer
      )

      expect(result.currentStreak).toBe(1)
      expect(result.longestStreak).toBe(5)
    })

    it('returns zero streaks with no activity', async () => {
      mockDb.query.userProgress.findMany.mockResolvedValue([])
      mockDb.query.submissions.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getStats('user-1')
        }),
        testLayer
      )

      expect(result.totalExercisesCompleted).toBe(0)
      expect(result.totalSubmissions).toBe(0)
      expect(result.currentStreak).toBe(0)
      expect(result.longestStreak).toBe(0)
      expect(result.lastActivityDate).toBeNull()
    })
  })

  describe('markExerciseCompleted', () => {
    it('calls upsert for exercise completion and updates concept mastery', async () => {
      // markExerciseCompleted also calls updateConceptMastery internally
      mockDb.query.exercises.findFirst.mockResolvedValue({
        id: 'exercise-1',
        conceptId: 'concept-1',
        concept: { id: 'concept-1' },
      })
      mockDb.query.exercises.findMany.mockResolvedValue([
        { id: 'exercise-1' },
        { id: 'exercise-2' },
      ])
      mockDb.query.userProgress.findMany.mockResolvedValue([
        { exerciseId: 'exercise-1', isCompleted: true },
      ])

      await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.markExerciseCompleted('user-1', 'exercise-1', 'submission-1')
        }),
        testLayer
      )

      // insert is called twice: once for userProgress upsert, once for conceptMastery upsert
      expect(mockDb.insert).toHaveBeenCalledTimes(2)
    })
  })

  describe('incrementAttempts', () => {
    it('calls upsert for attempt increment', async () => {
      await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.incrementAttempts('user-1', 'exercise-1')
        }),
        testLayer
      )

      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(mockDb._onConflictDoUpdate).toHaveBeenCalled()
    })
  })
})
