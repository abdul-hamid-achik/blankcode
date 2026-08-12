import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aggregateConceptWeakSpots,
  aggregateReadingGaps,
  mergeHeldConcepts,
  ProgressService,
  ProgressServiceLive,
  aggregateRustingConcepts,
  aggregateWeakReadings,
  smoothedFailureShare,
} from '../modules/progress/progress.service.js'

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
      readingSubmissions: { findMany: vi.fn() },
      reviewSchedules: { findMany: vi.fn().mockResolvedValue([]) },
      readingExercises: { findMany: vi.fn() },
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

/** A submission row shaped like `aggregateConceptWeakSpots` expects. */
function submission(
  status: string,
  concept: { id: string; slug: string; name: string; trackSlug: string }
) {
  return {
    status,
    exercise: {
      concept: {
        id: concept.id,
        slug: concept.slug,
        name: concept.name,
        track: { slug: concept.trackSlug },
      },
    },
  }
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
      expect(result?.isCompleted).toBe(true)
      expect(result?.attempts).toBe(3)
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

      // getConceptMastery now applies time-based decay on read and exposes
      // the underlying stored value alongside the effective one. With a
      // lastPracticedAt of "now", the effective level equals the stored level.
      expect(result).toMatchObject({
        ...mockMastery,
        storedMasteryLevel: 0.75,
      })
      expect(result?.masteryLevel).toBe(0.75)
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
      // The mastery row now includes storedMasteryLevel alongside the (decay-
      // applied) masteryLevel — for a row with no lastPracticedAt, decay is a
      // no-op so masteryLevel equals storedMasteryLevel.
      expect(result[0]).toEqual({
        conceptId: 'concept-1',
        conceptSlug: 'variables',
        conceptName: 'Variables',
        mastery: {
          conceptId: 'concept-1',
          masteryLevel: 0.5,
          storedMasteryLevel: 0.5,
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
    it('reports windowed presence from submission days', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-03T12:00:00Z'))

      mockDb.query.userProgress.findMany.mockResolvedValue([
        { completedAt: new Date('2026-02-03T10:00:00Z') },
        { completedAt: new Date('2026-02-02T15:00:00Z') },
        { completedAt: new Date('2026-02-01T09:00:00Z') },
      ])
      // Presence counts submission DAYS, not completions: showing up and
      // failing is practice. Two submissions on Feb 3, one attempt on Feb 1.
      mockDb.query.submissions.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-03T10:00:00Z') },
        { createdAt: new Date('2026-02-03T11:00:00Z') },
        { createdAt: new Date('2026-02-01T09:00:00Z') },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getStats('user-1')
        }),
        testLayer
      )

      expect(result?.totalExercisesCompleted).toBe(3)
      expect(result?.totalSubmissions).toBe(3)
      expect(result?.presence.window).toBe(7)
      expect(result?.presence.practiced).toBe(2)
      // Oldest → today: only Feb 1 and Feb 3 saw work.
      expect(result?.presence.days).toEqual([false, false, false, false, true, false, true])
      expect(result?.lastActivityDate).toBe(new Date('2026-02-03T10:00:00Z').toISOString())
    })

    it('shows empty presence with no activity', async () => {
      mockDb.query.userProgress.findMany.mockResolvedValue([])
      mockDb.query.submissions.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getStats('user-1')
        }),
        testLayer
      )

      expect(result?.totalExercisesCompleted).toBe(0)
      expect(result?.totalSubmissions).toBe(0)
      expect(result?.presence.practiced).toBe(0)
      expect(result?.presence.days).toEqual(Array(7).fill(false))
      expect(result?.lastActivityDate).toBeNull()
    })

    it('a day outside the window does not count', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-02-10T12:00:00Z'))

      mockDb.query.userProgress.findMany.mockResolvedValue([])
      mockDb.query.submissions.findMany.mockResolvedValue([
        // Eight days ago — one past the seven-day window.
        { createdAt: new Date('2026-02-02T10:00:00Z') },
        { createdAt: new Date('2026-02-10T10:00:00Z') },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getStats('user-1')
        }),
        testLayer
      )

      expect(result?.presence.practiced).toBe(1)
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

  // Pure aggregation helpers — no DB, same style as the presence tests above.
  describe('aggregateConceptWeakSpots', () => {
    const closures = {
      id: 'concept-1',
      slug: 'closures',
      name: 'Closures',
      trackSlug: 'typescript',
    }

    it('surfaces a concept with 3+ attempts and a high failed share', () => {
      const result = aggregateConceptWeakSpots(
        [
          submission('failed', closures),
          submission('failed', closures),
          submission('passed', closures),
        ],
        new Map()
      )

      expect(result).toEqual([
        {
          conceptSlug: 'closures',
          conceptName: 'Closures',
          trackSlug: 'typescript',
          attempts: 3,
          // Smoothed: (2 + 1) / (3 + 2). Raw ratios overstated small samples.
          failedShare: 3 / 5,
          completed: 0,
          total: 0,
        },
      ])
    })

    it('treats error the same as failed', () => {
      const result = aggregateConceptWeakSpots(
        [
          submission('error', closures),
          submission('error', closures),
          submission('passed', closures),
        ],
        new Map()
      )

      expect(result[0]?.failedShare).toBeCloseTo(3 / 5)
    })

    it('drops concepts with fewer than 3 attempts even at 100% failed', () => {
      const result = aggregateConceptWeakSpots(
        [submission('failed', closures), submission('failed', closures)],
        new Map()
      )

      expect(result).toEqual([])
    })

    it('keeps a low-failure concept when completion trails the total', () => {
      const result = aggregateConceptWeakSpots(
        [
          submission('passed', closures),
          submission('passed', closures),
          submission('passed', closures),
        ],
        new Map([
          ['concept-1', { conceptId: 'concept-1', exercisesCompleted: 1, exercisesTotal: 4 }],
        ])
      )

      expect(result).toEqual([
        {
          conceptSlug: 'closures',
          conceptName: 'Closures',
          trackSlug: 'typescript',
          attempts: 3,
          // Smoothed floor: zero failures still reads (0 + 1) / (3 + 2).
          failedShare: 1 / 5,
          completed: 1,
          total: 4,
        },
      ])
    })

    it('drops a concept with a low failed share and no completion gap', () => {
      const result = aggregateConceptWeakSpots(
        [
          submission('passed', closures),
          submission('passed', closures),
          submission('passed', closures),
        ],
        new Map([
          ['concept-1', { conceptId: 'concept-1', exercisesCompleted: 4, exercisesTotal: 4 }],
        ])
      )

      expect(result).toEqual([])
    })

    it('sorts by failedShare descending and caps at 5', () => {
      // 7 concepts, each 10 attempts, raw failure stepping 0.4 → 1.0. All
      // clear the smoothed 0.4 threshold, so the cap trims the list and must
      // keep the 5 highest shares.
      const submissions = Array.from({ length: 7 }, (_, i) => {
        const concept = {
          id: `concept-${i}`,
          slug: `concept-${i}`,
          name: `Concept ${i}`,
          trackSlug: 'typescript',
        }
        const failedCount = 4 + i
        return [
          ...Array.from({ length: failedCount }, () => submission('failed', concept)),
          ...Array.from({ length: 10 - failedCount }, () => submission('passed', concept)),
        ]
      }).flat()

      const result = aggregateConceptWeakSpots(submissions, new Map())

      expect(result).toHaveLength(5)
      // Smoothed: failed 10..6 of 10 → (failed + 1) / 12.
      expect(result.map((r) => r.failedShare)).toEqual([11 / 12, 10 / 12, 9 / 12, 8 / 12, 7 / 12])
      expect(result.map((r) => r.conceptSlug)).toEqual([
        'concept-6',
        'concept-5',
        'concept-4',
        'concept-3',
        'concept-2',
      ])
    })
  })

  describe('mergeHeldConcepts', () => {
    const closures = {
      conceptSlug: 'closures',
      conceptName: 'Closures',
      trackSlug: 'typescript',
      attempts: 4,
      failedShare: 0.6,
      completed: 1,
      total: 4,
    }

    it('puts an unexplained hold on the drill list even with no failures', () => {
      const result = mergeHeldConcepts(
        [],
        [
          {
            conceptSlug: 'supervision',
            conceptName: 'Supervise the Agent',
            trackSlug: 'typescript',
          },
        ]
      )
      expect(result).toEqual([
        {
          conceptSlug: 'supervision',
          conceptName: 'Supervise the Agent',
          trackSlug: 'typescript',
          attempts: 0,
          failedShare: 0,
          completed: 0,
          total: 0,
          why: 'unexplained',
        },
      ])
    })

    it('does not duplicate a concept the scoreboard already named', () => {
      const result = mergeHeldConcepts(
        [closures],
        [{ conceptSlug: 'closures', conceptName: 'Closures', trackSlug: 'typescript' }]
      )
      expect(result).toEqual([closures])
    })

    it('keeps one row per held concept', () => {
      const held = {
        conceptSlug: 'async-patterns',
        conceptName: 'Async Patterns',
        trackSlug: 'typescript',
      }
      const result = mergeHeldConcepts([], [held, held])
      expect(result).toHaveLength(1)
    })
  })

  describe('aggregateReadingGaps', () => {
    it('counts misses per point across submissions', () => {
      const result = aggregateReadingGaps([
        {
          rubricResults: [
            { point: 'explains the cache invalidation', hit: false },
            { point: 'names the race condition', hit: true },
          ],
        },
        {
          rubricResults: [{ point: 'explains the cache invalidation', hit: false }],
        },
      ])

      expect(result).toEqual([{ point: 'explains the cache invalidation', misses: 2 }])
    })

    it('excludes points with fewer than 2 misses', () => {
      const result = aggregateReadingGaps([
        { rubricResults: [{ point: 'one-off miss', hit: false }] },
      ])

      expect(result).toEqual([])
    })

    it('returns [] for no reading submissions', () => {
      expect(aggregateReadingGaps([])).toEqual([])
    })

    it('sorts by misses descending and caps at 5', () => {
      const rows = Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: i + 2 }, () => ({ point: `point-${i}`, hit: false }))
      ).map((rubricResults) => ({ rubricResults }))

      const result = aggregateReadingGaps(rows)

      expect(result).toHaveLength(5)
      const misses = result.map((r) => r.misses)
      expect(misses).toEqual(misses.toSorted((a, b) => b - a))
      // point-5 has the most misses (7) and must survive the cap.
      expect(result[0]).toEqual({ point: 'point-5', misses: 7 })
    })
  })

  describe('getWeakSpots', () => {
    it('joins submissions, mastery, and reading submissions into one payload', async () => {
      mockDb.query.submissions.findMany.mockResolvedValue([
        {
          status: 'failed',
          exercise: {
            concept: {
              id: 'concept-1',
              slug: 'closures',
              name: 'Closures',
              track: { slug: 'typescript' },
            },
          },
        },
        {
          status: 'failed',
          exercise: {
            concept: {
              id: 'concept-1',
              slug: 'closures',
              name: 'Closures',
              track: { slug: 'typescript' },
            },
          },
        },
        {
          status: 'passed',
          exercise: {
            concept: {
              id: 'concept-1',
              slug: 'closures',
              name: 'Closures',
              track: { slug: 'typescript' },
            },
          },
        },
      ])
      mockDb.query.conceptMastery.findMany.mockResolvedValue([
        {
          conceptId: 'concept-1',
          exercisesCompleted: 1,
          exercisesTotal: 4,
          masteryLevel: 0.25,
          lastPracticedAt: new Date(),
        },
      ])
      mockDb.query.readingSubmissions.findMany.mockResolvedValue([
        {
          rubricResults: [{ point: 'explains the trade-off', hit: false }],
          readingExerciseId: 'r1',
          score: 4,
          maxScore: 16,
        },
        {
          rubricResults: [{ point: 'explains the trade-off', hit: false }],
          readingExerciseId: 'r1',
          score: 6,
          maxScore: 16,
        },
      ])
      mockDb.query.concepts.findMany.mockResolvedValue([
        { id: 'concept-1', slug: 'closures', name: 'Closures', track: { slug: 'typescript' } },
      ])
      mockDb.query.readingExercises.findMany.mockResolvedValue([
        { id: 'r1', slug: 'paged-client-cache', title: 'A paged client' },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getWeakSpots('user-1')
        }),
        testLayer
      )

      expect(result.concepts).toEqual([
        {
          conceptSlug: 'closures',
          conceptName: 'Closures',
          trackSlug: 'typescript',
          attempts: 3,
          failedShare: 3 / 5,
          completed: 1,
          total: 4,
        },
      ])
      expect(result.readingGaps).toEqual([{ point: 'explains the trade-off', misses: 2 }])
      // Fresh practice keeps the concept off the rusting list even at 0.25.
      expect(result.rusting).toEqual([])
      // Best read is 6/16 — under the 60% line, so the reading surfaces.
      expect(result.weakReadings).toEqual([
        { slug: 'paged-client-cache', title: 'A paged client', bestScore: 6, maxScore: 16 },
      ])
    })

    it('returns empty lists when there is no history', async () => {
      mockDb.query.submissions.findMany.mockResolvedValue([])
      mockDb.query.conceptMastery.findMany.mockResolvedValue([])
      mockDb.query.readingSubmissions.findMany.mockResolvedValue([])
      mockDb.query.concepts.findMany.mockResolvedValue([])
      mockDb.query.readingExercises.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getWeakSpots('user-1')
        }),
        testLayer
      )

      expect(result).toEqual({ concepts: [], readingGaps: [], rusting: [], weakReadings: [] })
    })

    it('surfaces an unexplained hold as a drillable concept', async () => {
      mockDb.query.submissions.findMany.mockResolvedValue([])
      mockDb.query.conceptMastery.findMany.mockResolvedValue([])
      mockDb.query.readingSubmissions.findMany.mockResolvedValue([])
      mockDb.query.concepts.findMany.mockResolvedValue([])
      mockDb.query.readingExercises.findMany.mockResolvedValue([])
      mockDb.query.reviewSchedules.findMany.mockResolvedValue([
        {
          exercise: {
            concept: {
              slug: 'supervision',
              name: 'Supervise the Agent',
              track: { slug: 'typescript' },
            },
          },
        },
      ])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ProgressService
          return yield* svc.getWeakSpots('user-1')
        }),
        testLayer
      )

      expect(result.concepts).toEqual([
        {
          conceptSlug: 'supervision',
          conceptName: 'Supervise the Agent',
          trackSlug: 'typescript',
          attempts: 0,
          failedShare: 0,
          completed: 0,
          total: 0,
          why: 'unexplained',
        },
      ])
    })
  })
})

/**
 * The hardening round: small samples must not scream, rust must be old and
 * real, and a reading only counts as weak by its BEST attempt.
 */
describe('smoothedFailureShare', () => {
  it('pulls small samples toward the middle', () => {
    // Three of three failed is 0.8, not the raw ratio's certain 1.0.
    expect(smoothedFailureShare(3, 3)).toBeCloseTo(0.8)
    // One of three failed sits exactly on the 0.4 threshold — barely surfaces.
    expect(smoothedFailureShare(1, 3)).toBeCloseTo(0.4)
    expect(smoothedFailureShare(0, 3)).toBeCloseTo(0.2)
  })

  it('converges to the raw ratio as evidence accumulates', () => {
    expect(smoothedFailureShare(30, 30)).toBeGreaterThan(0.95)
    expect(smoothedFailureShare(15, 30)).toBeCloseTo(0.5)
  })
})

describe('aggregateRustingConcepts', () => {
  const NOW = new Date('2026-08-08T12:00:00Z')
  const CONCEPTS = new Map([
    ['c1', { slug: 'generics', name: 'Generics', trackSlug: 'typescript' }],
  ])

  const row = (overrides: Partial<Parameters<typeof aggregateRustingConcepts>[0][number]>) => ({
    conceptId: 'c1',
    masteryLevel: 0.9,
    exercisesCompleted: 3,
    lastPracticedAt: new Date('2026-06-01T12:00:00Z'),
    ...overrides,
  })

  it('surfaces a completed concept whose mastery decayed away', () => {
    const out = aggregateRustingConcepts([row({})], CONCEPTS, NOW)
    expect(out).toHaveLength(1)
    expect(out[0]?.conceptSlug).toBe('generics')
    expect(out[0]?.decayedMastery).toBeLessThan(0.35)
    expect(out[0]?.idleDays).toBeGreaterThan(60)
  })

  it('leaves fresh practice alone regardless of level', () => {
    const out = aggregateRustingConcepts(
      [row({ lastPracticedAt: new Date('2026-08-05T12:00:00Z'), masteryLevel: 0.1 })],
      CONCEPTS,
      NOW
    )
    expect(out).toHaveLength(0)
  })

  it('never accuses a concept with no completions', () => {
    const out = aggregateRustingConcepts([row({ exercisesCompleted: 0 })], CONCEPTS, NOW)
    expect(out).toHaveLength(0)
  })

  it('keeps recently held mastery that has not decayed below the floor', () => {
    // Ten days idle at 0.9: decayed ≈ 0.55 — held, not rusting.
    const out = aggregateRustingConcepts(
      [row({ lastPracticedAt: new Date('2026-07-29T12:00:00Z') })],
      CONCEPTS,
      NOW
    )
    expect(out).toHaveLength(0)
  })
})

describe('aggregateWeakReadings', () => {
  const META = new Map([['r1', { slug: 'paged-client-cache', title: 'A paged client' }]])

  it('judges by the best attempt, not the worst', () => {
    const out = aggregateWeakReadings(
      [
        { readingExerciseId: 'r1', score: 2, maxScore: 16 },
        { readingExerciseId: 'r1', score: 12, maxScore: 16 },
      ],
      META
    )
    // Best attempt is 75% — above the 60% line, so the reading is not weak.
    expect(out).toHaveLength(0)
  })

  it('surfaces a reading the reader never beat', () => {
    const out = aggregateWeakReadings(
      [
        { readingExerciseId: 'r1', score: 3, maxScore: 16 },
        { readingExerciseId: 'r1', score: 7, maxScore: 16 },
      ],
      META
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.bestScore).toBe(7)
  })

  it('ignores rows whose exercise no longer exists', () => {
    const out = aggregateWeakReadings([{ readingExerciseId: 'gone', score: 0, maxScore: 10 }], META)
    expect(out).toHaveLength(0)
  })
})
