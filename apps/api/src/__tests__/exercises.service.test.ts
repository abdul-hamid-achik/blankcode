import { Drizzle } from '@blankcode/db/client'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestError, NotFoundError } from '../api/errors.js'
import { ExercisesService, ExercisesServiceLive } from '../modules/exercises/exercises.service.js'

function createMockDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
  const insertFn = vi.fn().mockReturnValue({ values })

  const where = vi.fn().mockResolvedValue(undefined)
  const deleteFn = vi.fn().mockReturnValue({ where })

  return {
    query: {
      tracks: {
        findFirst: vi.fn(),
      },
      concepts: {
        findFirst: vi.fn(),
      },
      exercises: {
        findFirst: vi.fn(),
      },
      codeDrafts: {
        findFirst: vi.fn(),
      },
      submissions: {
        findFirst: vi.fn(),
      },
    },
    insert: insertFn,
    delete: deleteFn,
    _chainRefs: { onConflictDoUpdate, values, where },
  }
}

function makeTestLayer(mockDb: ReturnType<typeof createMockDb>) {
  return ExercisesServiceLive.pipe(Layer.provide(Layer.succeed(Drizzle, mockDb as any)))
}

async function runService<A, E>(
  effect: Effect.Effect<A, E, ExercisesService>,
  layer: Layer.Layer<ExercisesService>
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
  if (Exit.isSuccess(exit)) return exit.value
  const cause = exit.cause
  if (Cause.isFailType(cause)) {
    throw cause.error
  }
  throw new Error('Unexpected effect failure')
}

describe('ExercisesService', () => {
  let mockDb: ReturnType<typeof createMockDb>
  let testLayer: Layer.Layer<ExercisesService>

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
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockExercise = {
    id: 'exercise-1',
    conceptId: 'concept-1',
    slug: 'promise-basics',
    title: 'Promise Basics',
    description: 'Learn promise basics',
    difficulty: 'beginner',
    starterCode: 'const x = ___blank___;',
    solutionCode: 'const x = 42;',
    testCode: 'expect(x).toBe(42);',
    hints: ['Think about the answer to everything'],
    order: 1,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockDraft = {
    id: 'draft-1',
    userId: 'user-1',
    exerciseId: 'exercise-1',
    code: 'const x = 41; // draft in progress',
    createdAt: new Date(),
    updatedAt: new Date('2026-02-17T10:00:00Z'),
  }

  const mockSubmission = {
    id: 'submission-1',
    userId: 'user-1',
    exerciseId: 'exercise-1',
    code: 'const x = 42;',
    status: 'passed',
    testResults: [{ name: 'test1', passed: true, message: null, duration: 10 }],
    errorMessage: null,
    executionTimeMs: 150,
    createdAt: new Date('2026-02-16T08:00:00Z'),
    updatedAt: new Date('2026-02-16T08:00:00Z'),
  }

  beforeEach(() => {
    mockDb = createMockDb()
    testLayer = makeTestLayer(mockDb)
  })

  // ---------------------------------------------------------------------------
  // findByConceptSlug
  // ---------------------------------------------------------------------------
  describe('findByConceptSlug', () => {
    it('returns exercises for a valid concept slug and track slug', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue({
        ...mockConcept,
        track: mockTrack,
        exercises: [mockExercise],
      })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findByConceptSlug('typescript', 'async-patterns')
        }),
        testLayer
      )

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockExercise)
      expect(mockDb.query.tracks.findFirst).toHaveBeenCalledOnce()
      expect(mockDb.query.concepts.findFirst).toHaveBeenCalledOnce()
    })

    it('returns empty array when concept has no published exercises', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue({
        ...mockConcept,
        track: mockTrack,
        exercises: [],
      })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findByConceptSlug('typescript', 'async-patterns')
        }),
        testLayer
      )

      expect(result).toHaveLength(0)
    })

    it('throws NotFoundError when concept does not exist', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findByConceptSlug('typescript', 'nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when concept does not exist (undefined)', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue(undefined)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findByConceptSlug('typescript', 'nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when track slug does not match', async () => {
      // The service now looks up the track first by slug.
      // If no track matches, it returns null and a NotFoundError is raised.
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findByConceptSlug('typescript', 'async-patterns')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('NotFoundError contains the concept slug as the id', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue(null)

      try {
        await runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findByConceptSlug('typescript', 'missing-concept')
          }),
          testLayer
        )
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError)
        expect((err as NotFoundError).id).toBe('missing-concept')
        expect((err as NotFoundError).resource).toBe('Concept')
      }
    })

    it('throws NotFoundError when the DB query itself rejects', async () => {
      mockDb.query.tracks.findFirst.mockRejectedValue(new Error('DB connection lost'))

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findByConceptSlug('typescript', 'async-patterns')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ---------------------------------------------------------------------------
  // findBySlug
  // ---------------------------------------------------------------------------
  describe('findBySlug', () => {
    it('returns exercise for valid track, concept, and exercise slug', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue({
        ...mockConcept,
        track: mockTrack,
      })
      mockDb.query.exercises.findFirst.mockResolvedValue(mockExercise)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findBySlug('typescript', 'async-patterns', 'promise-basics')
        }),
        testLayer
      )

      expect(result.slug).toBe('promise-basics')
      expect(result.id).toBe('exercise-1')
      expect(mockDb.query.tracks.findFirst).toHaveBeenCalledOnce()
      expect(mockDb.query.concepts.findFirst).toHaveBeenCalledOnce()
      expect(mockDb.query.exercises.findFirst).toHaveBeenCalledOnce()
    })

    it('throws NotFoundError when concept does not exist', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findBySlug('typescript', 'nonexistent', 'promise-basics')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)

      // exercises.findFirst should never have been called
      expect(mockDb.query.exercises.findFirst).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when track slug does not match', async () => {
      // The service now looks up the track first by slug.
      // If no track matches, it returns null and a NotFoundError is raised.
      mockDb.query.tracks.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findBySlug('typescript', 'async-patterns', 'promise-basics')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)

      expect(mockDb.query.concepts.findFirst).not.toHaveBeenCalled()
      expect(mockDb.query.exercises.findFirst).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when exercise does not exist under the concept', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue({
        ...mockConcept,
        track: mockTrack,
      })
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findBySlug('typescript', 'async-patterns', 'nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when exercise query returns undefined', async () => {
      mockDb.query.tracks.findFirst.mockResolvedValue(mockTrack)
      mockDb.query.concepts.findFirst.mockResolvedValue({
        ...mockConcept,
        track: mockTrack,
      })
      mockDb.query.exercises.findFirst.mockResolvedValue(undefined)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findBySlug('typescript', 'async-patterns', 'nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  describe('findById', () => {
    it('returns a published exercise by id with concept and track', async () => {
      const exerciseWithRelations = {
        ...mockExercise,
        concept: {
          ...mockConcept,
          track: mockTrack,
        },
      }
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findById('exercise-1')
        }),
        testLayer
      )

      expect(result.id).toBe('exercise-1')
      expect(result.concept.track.slug).toBe('typescript')
      expect(mockDb.query.exercises.findFirst).toHaveBeenCalledOnce()
    })

    it('throws NotFoundError when exercise does not exist', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findById('nonexistent')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when exercise is unpublished (query returns null due to isPublished filter)', async () => {
      // The where clause filters on isPublished === true,
      // so an unpublished exercise will come back as null
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findById('exercise-unpublished')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('NotFoundError contains the exercise id', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      try {
        await runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findById('some-id')
          }),
          testLayer
        )
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError)
        expect((err as NotFoundError).id).toBe('some-id')
        expect((err as NotFoundError).resource).toBe('Exercise')
      }
    })

    it('throws NotFoundError when the DB query rejects', async () => {
      mockDb.query.exercises.findFirst.mockRejectedValue(new Error('timeout'))

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findById('exercise-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ---------------------------------------------------------------------------
  // findWithProgress
  // ---------------------------------------------------------------------------
  describe('findWithProgress', () => {
    const exerciseWithRelations = {
      ...mockExercise,
      concept: {
        ...mockConcept,
        track: mockTrack,
      },
    }

    it('returns draft code when a draft exists', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(mockDraft)
      mockDb.query.submissions.findFirst.mockResolvedValue(mockSubmission)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result.code).toBe(mockDraft.code)
      expect(result.codeSource).toBe('draft')
      expect(result.draft).toEqual({ updatedAt: mockDraft.updatedAt })
      expect(result.lastSubmission).toEqual({
        id: mockSubmission.id,
        status: mockSubmission.status,
        createdAt: mockSubmission.createdAt,
      })
    })

    it('returns submission code when no draft exists but a submission exists', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(null)
      mockDb.query.submissions.findFirst.mockResolvedValue(mockSubmission)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result.code).toBe(mockSubmission.code)
      expect(result.codeSource).toBe('submission')
      expect(result.draft).toBeNull()
      expect(result.lastSubmission).toEqual({
        id: mockSubmission.id,
        status: mockSubmission.status,
        createdAt: mockSubmission.createdAt,
      })
    })

    it('returns starter code when neither draft nor submission exists', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(null)
      mockDb.query.submissions.findFirst.mockResolvedValue(null)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result.code).toBe(mockExercise.starterCode)
      expect(result.codeSource).toBe('starter')
      expect(result.draft).toBeNull()
      expect(result.lastSubmission).toBeNull()
    })

    it('returns starter code when both draft and submission queries return undefined', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(undefined)
      mockDb.query.submissions.findFirst.mockResolvedValue(undefined)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result.code).toBe(mockExercise.starterCode)
      expect(result.codeSource).toBe('starter')
    })

    it('prioritizes draft over submission when both exist', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(mockDraft)
      mockDb.query.submissions.findFirst.mockResolvedValue(mockSubmission)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      // Draft takes precedence even though submission exists
      expect(result.codeSource).toBe('draft')
      expect(result.code).toBe(mockDraft.code)
    })

    it('includes exercise metadata in the returned object', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(null)
      mockDb.query.submissions.findFirst.mockResolvedValue(null)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result.exercise).toEqual(exerciseWithRelations)
      expect(result.exercise.concept.track.slug).toBe('typescript')
      expect(result.exercise.title).toBe('Promise Basics')
      expect(result.exercise.starterCode).toBe(mockExercise.starterCode)
    })

    it('throws NotFoundError when exercise does not exist', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.findWithProgress('nonexistent', 'user-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)

      // Should NOT have queried drafts or submissions
      expect(mockDb.query.codeDrafts.findFirst).not.toHaveBeenCalled()
      expect(mockDb.query.submissions.findFirst).not.toHaveBeenCalled()
    })

    it('gracefully handles draft query failure by falling back to submission', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockRejectedValue(new Error('draft query exploded'))
      mockDb.query.submissions.findFirst.mockResolvedValue(mockSubmission)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      // Draft query failed and was caught, so draft is undefined/falsy
      // Should fall through to submission
      expect(result.codeSource).toBe('submission')
      expect(result.code).toBe(mockSubmission.code)
    })

    it('gracefully handles submission query failure by falling back to starter', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockResolvedValue(null)
      mockDb.query.submissions.findFirst.mockRejectedValue(new Error('submission query exploded'))

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      // Submission query failed and was caught, so lastSubmission is undefined/falsy
      // Should fall through to starter code
      expect(result.codeSource).toBe('starter')
      expect(result.code).toBe(mockExercise.starterCode)
    })

    it('gracefully handles both draft and submission query failures', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(exerciseWithRelations)
      mockDb.query.codeDrafts.findFirst.mockRejectedValue(new Error('draft boom'))
      mockDb.query.submissions.findFirst.mockRejectedValue(new Error('submission boom'))

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.findWithProgress('exercise-1', 'user-1')
        }),
        testLayer
      )

      expect(result.codeSource).toBe('starter')
      expect(result.code).toBe(mockExercise.starterCode)
      expect(result.draft).toBeNull()
      expect(result.lastSubmission).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // saveDraft
  // ---------------------------------------------------------------------------
  describe('saveDraft', () => {
    it('upserts the draft and returns success', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(mockExercise)

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.saveDraft('user-1', 'exercise-1', 'const x = 42;')
        }),
        testLayer
      )

      expect(result).toEqual({ success: true })
      expect(mockDb.insert).toHaveBeenCalledOnce()
      expect(mockDb._chainRefs.values).toHaveBeenCalledOnce()
      expect(mockDb._chainRefs.onConflictDoUpdate).toHaveBeenCalledOnce()
    })

    it('throws NotFoundError when exercise does not exist', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(null)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.saveDraft('user-1', 'nonexistent', 'code')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)

      // insert should never have been called
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('throws NotFoundError when exercise is undefined', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(undefined)

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.saveDraft('user-1', 'nonexistent', 'code')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws BadRequestError when the insert operation fails', async () => {
      mockDb.query.exercises.findFirst.mockResolvedValue(mockExercise)
      mockDb._chainRefs.onConflictDoUpdate.mockRejectedValue(new Error('unique constraint'))

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.saveDraft('user-1', 'exercise-1', 'const x = 42;')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(BadRequestError)
    })

    it('throws NotFoundError when exercise lookup itself rejects', async () => {
      mockDb.query.exercises.findFirst.mockRejectedValue(new Error('db error'))

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.saveDraft('user-1', 'exercise-1', 'code')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ---------------------------------------------------------------------------
  // deleteDraft
  // ---------------------------------------------------------------------------
  describe('deleteDraft', () => {
    it('returns success when draft exists and is deleted', async () => {
      mockDb._chainRefs.where.mockResolvedValue({ rowCount: 1 })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.deleteDraft('user-1', 'exercise-1')
        }),
        testLayer
      )

      expect(result).toEqual({ success: true })
      expect(mockDb.delete).toHaveBeenCalledOnce()
      expect(mockDb._chainRefs.where).toHaveBeenCalledOnce()
    })

    it('returns success even when no draft existed (no rows deleted)', async () => {
      mockDb._chainRefs.where.mockResolvedValue({ rowCount: 0 })

      const result = await runService(
        Effect.gen(function* () {
          const svc = yield* ExercisesService
          return yield* svc.deleteDraft('user-1', 'exercise-999')
        }),
        testLayer
      )

      expect(result).toEqual({ success: true })
    })

    it('throws BadRequestError when the delete query fails', async () => {
      mockDb._chainRefs.where.mockRejectedValue(new Error('delete failed'))

      await expect(
        runService(
          Effect.gen(function* () {
            const svc = yield* ExercisesService
            return yield* svc.deleteDraft('user-1', 'exercise-1')
          }),
          testLayer
        )
      ).rejects.toBeInstanceOf(BadRequestError)
    })
  })
})
