import { Drizzle } from '@blankcode/db/client'
import type { TrackSlug } from '@blankcode/shared'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../api/errors.js'
import { TracksService, TracksServiceLive } from '../modules/tracks/tracks.service.js'

function createMockDb() {
  return {
    query: {
      tracks: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  return TracksServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as any)))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, TracksService>,
  layer: Layer.Layer<TracksService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('TracksService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<TracksService>

  const mockTrack = {
    id: 'track-1',
    slug: 'typescript',
    name: 'TypeScript',
    description: 'Learn TypeScript',
    iconUrl: null,
    order: 1,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockConcept = {
    id: 'concept-1',
    trackId: 'track-1',
    slug: 'async-patterns',
    name: 'Async Patterns',
    description: 'Learn async patterns',
    order: 1,
    isPublished: true,
  }

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
  })

  describe('findAll', () => {
    it('returns all published tracks', async () => {
      mockDb.query.tracks.findMany.mockResolvedValue([mockTrack])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* TracksService
          return yield* svc.findAll()
        }),
        testLayer
      )

      expect(result).toHaveLength(1)
      expect(result[0]?.slug).toBe('typescript')
    })

    it('returns empty array when no tracks', async () => {
      mockDb.query.tracks.findMany.mockResolvedValue([])

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* TracksService
          return yield* svc.findAll()
        }),
        testLayer
      )

      expect(result).toHaveLength(0)
    })
  })

  describe('findBySlug', () => {
    it('returns track with concepts', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue({
        ...mockTrack,
        concepts: [mockConcept],
      })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* TracksService
          return yield* svc.findBySlug('typescript' as TrackSlug)
        }),
        testLayer
      )

      expect(result.slug).toBe('typescript')
      expect(result.concepts).toHaveLength(1)
    })

    it('throws NotFoundError for invalid slug', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* TracksService
            return yield* svc.findBySlug('nonexistent' as TrackSlug)
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('findById', () => {
    it('returns track by id', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* TracksService
          return yield* svc.findById('track-1')
        }),
        testLayer
      )

      expect(result.id).toBe('track-1')
    })

    it('throws NotFoundError for invalid id', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* TracksService
            return yield* svc.findById('nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
